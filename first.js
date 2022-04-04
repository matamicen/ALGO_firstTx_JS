const algosdk = require('algosdk');
//

const keypress = async () => {
    process.stdin.setRawMode(true)
    return new Promise(resolve => process.stdin.once('data', () => {
        process.stdin.setRawMode(false)
        resolve()
    })) 
}

/**
 * Wait until the transaction is confirmed or rejected, or until 'timeout'
 * number of rounds have passed.
 * @param {algosdk.Algodv2} algodClient the Algod V2 client
 * @param {string} txId the transaction ID to wait for
 * @param {number} timeout maximum number of rounds to wait
 * @return {Promise<*>} pending transaction information
 * @throws Throws an error if the transaction is not confirmed or rejected in the next timeout rounds
 */
 const waitForConfirmation = async function (algodClient, txId, timeout) {
    if (algodClient == null || txId == null || timeout < 0) {
        throw new Error("Bad arguments");
    }

    const status = (await algodClient.status().do());
    if (status === undefined) {
        throw new Error("Unable to get node status");
    }

    const startround = status["last-round"] + 1;
    let currentround = startround;

    while (currentround < (startround + timeout)) {
        const pendingInfo = await algodClient.pendingTransactionInformation(txId).do();
        if (pendingInfo !== undefined) {
            if (pendingInfo["confirmed-round"] !== null && pendingInfo["confirmed-round"] > 0) {
                //Got the completed Transaction
                return pendingInfo;
            } else {
                if (pendingInfo["pool-error"] != null && pendingInfo["pool-error"].length > 0) {
                    // If there was a pool error, then the transaction has been rejected!
                    throw new Error("Transaction " + txId + " rejected - pool error: " + pendingInfo["pool-error"]);
                }
            }
        }
        await algodClient.statusAfterBlock(currentround).do();
        currentround++;
    }
    throw new Error("Transaction " + txId + " not confirmed after " + timeout + " rounds!");
};


const createAccount =  function (){
    try{  
        const myaccount = algosdk.generateAccount();
        console.log("Account Address = " + myaccount.addr);
        let account_mnemonic = algosdk.secretKeyToMnemonic(myaccount.sk);
        console.log("Account Mnemonic = "+ account_mnemonic);
        console.log("Account created. Save off Mnemonic and address");
        console.log("Add funds to account using the TestNet Dispenser: ");
        console.log("https://dispenser.testnet.aws.algodev.network/ ");
        return myaccount;
    }
    catch (err) {
        console.log("err", err);
    }
};


async function firstTransaction() {

    try {
        
        let myAccount = createAccount();
        console.log("Press any key when the account is funded");
        await keypress();
        // Connect your local sandbox client
        // const algodToken = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        // const algodServer = 'http://localhost';
        // const algodPort = 4001;

        // const algodServer = "https://api.testnet.algoexplorer.io";
        const algodServer = "https://node.testnet.algoexplorerapi.io";
        // const algodServerMainnet = "https://node.algoexplorerapi.io";
        const algodPort = '';
        const algoIndexer = "https://algoindexer.testnet.algoexplorerapi.io/"
        // const algoIndexerMainnet = "https://algoindexer.algoexplorerapi.io/"
        const algodToken = '';
       

        //Check your balance
        
        let algodClient = new algosdk.Algodv2(algodToken, algodServer,algodPort);

        //Check your balance
        let indexer = new algosdk.Indexer(algodToken, algoIndexer,algodPort);
        let accountInfo = await indexer.lookupAccountByID(myAccount.addr).do()
        let startingAmount = accountInfo.account.amount;
        console.log("Information for Account before paying: " + JSON.stringify(accountInfo, undefined, 2));
        
         // Construct the transaction
         let params = await algodClient.getTransactionParams().do();
         // comment out the next two lines to use suggested fee
         params.fee = 1000;
         params.flatFee = true;
 
         // receiver defined as TestNet faucet address 
         const receiver = "MEBVPYXHXJIS2RBGIL62HM4ARR5B4U46HJ6KS2T3ACWPVSZEE4NOLI6CJM";
         const enc = new TextEncoder();
         const note = enc.encode("Hello World man!");
         let amount = 2000000;
         let closeout = receiver; //closeRemainderTo
         let sender = myAccount.addr;
         let txn = algosdk.makePaymentTxnWithSuggestedParams(sender, receiver, amount, undefined, note, params);

 
         // Sign the transaction
         let signedTxn = txn.signTxn(myAccount.sk);
         let txId = txn.txID().toString();
         console.log("Signed transaction with txID: %s", txId);
 
         // Submit the transaction
         await algodClient.sendRawTransaction(signedTxn).do();
 
         // Wait for confirmation
         let confirmedTxn = await waitForConfirmation(algodClient, txId, 4);
       
         //Get the completed Transaction
         console.log("Transaction " + txId + " confirmed in round " + confirmedTxn["confirmed-round"]);
 
         var string = new TextDecoder().decode(confirmedTxn.txn.txn.note);
         console.log("Note field: ", string);
        
         console.log("Transaction Amount: %d microAlgos", confirmedTxn.txn.txn.amt);        
         console.log("Transaction Fee: %d microAlgos", confirmedTxn.txn.txn.fee);
         let closeoutamt = startingAmount - confirmedTxn.txn.txn.amt - confirmedTxn.txn.txn.fee;        
         console.log("Close To Amount: %d microAlgos", closeoutamt);
   
        // Call the balance of the account again
        accountInfo = await indexer.lookupAccountByID(myAccount.addr).do()
        startingAmount = accountInfo.account.amount;
        console.log("Information for Account after paying: " + JSON.stringify(accountInfo, undefined, 2));
    }
        catch (err) {
            console.log("err", err);
        }
}

firstTransaction()