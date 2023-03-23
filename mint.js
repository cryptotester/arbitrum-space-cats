import { ABI_NFTCOLLECTION } from "./abi_nftCollection.js";
import { ERC20_ABI } from "./abi_erc20.js";
import { CHAIN_INFO } from "./chainInfo.js";
import { init, showOrHideError, onConnect, handleLowBalance, switchNetwork, sleep, getSupportedChainNames } from "./shared.js";

const IS_PROD = true; // false = TESTNET, true = PROD

const SWITCH_TO_CHAIN_ID = IS_PROD ? 42161 : 41;

let price = '7000000000000000000';

const Web3 = window.Web3;

let web3, chainId, selectedAccount, contract, contractAddress;

async function fetchAccountData() {
  showOrHideError();

  web3 = new Web3(window.provider);

  if (SWITCH_TO_CHAIN_ID) await switchNetwork(web3, SWITCH_TO_CHAIN_ID);
  
  chainId = await web3.eth.getChainId();

  contractAddress = CHAIN_INFO[chainId]?.contractAddress;
  if (contractAddress != undefined) {
    contract = await new web3.eth.Contract(ABI_NFTCOLLECTION, contractAddress);
    document.querySelector("#prepare").style.display = "none";
    document.querySelector("#connected").style.display = "block";    
  } else {
    let chainMessage;
    if (SWITCH_TO_CHAIN_ID) {
      chainMessage = `Please connect to ${CHAIN_INFO[SWITCH_TO_CHAIN_ID].name}`;
    } else {
      let supportedChainNames = getSupportedChainNames(CHAIN_INFO, IS_PROD);
      chainMessage = `Please connect to one of our supported chains: ${supportedChainNames.join(', ')}`
    }
    showOrHideError(chainMessage);
    return;
  }

  const accounts = await web3.eth.getAccounts();
  selectedAccount = accounts[0];
}

async function getTokenContract(tokenAddress) {
  // console.log(`ERC20 Token address: ${tokenAddress}`);
  return new web3.eth.Contract(ERC20_ABI, tokenAddress);
}

async function mint() {
  showOrHideError();
  try {
    const BN = web3.utils.toBN;

    let selectedCoin = 'ARB';

    // ERC20 token payment, e.g. USDC or any other token
    console.log(`Initiating ERC-20 token payment in ARB`);
    
    const token = CHAIN_INFO[42161].currencies[selectedCoin];
    const tokenContract = await getTokenContract(token.address);
    let multiplier = 10 ** token.decimals; // Use the proper token decimals (not only 18, USDC e.g. has only 6)

    let totalValue = BN(price);
    let humanFriendlyAmount = parseInt(price) / parseInt(multiplier);
    console.log('Total Value:', totalValue.toString(), 'Human friendly:', humanFriendlyAmount);

    if (totalValue == 0) {
      showOrHideError('The amount must be > 0 in order to proceed');
      return;
    }

    let lowBalanceMessage = `You don't have enough balance. You need [AMOUNT].`;
    let hasEnoughBalance = await handleLowBalance(web3, selectedAccount, totalValue, lowBalanceMessage, tokenContract);
    if (!hasEnoughBalance) {
      return;
    }

    interactionInProgress();
    let error;

    let allowance = await tokenContract.methods.allowance(selectedAccount, contractAddress).call();
    console.log(`Actual allowance: ${allowance}`);
    if (BN(allowance).lt(BN(totalValue))) {
      // Initiating approval request
      console.log(`Asking approval to spend ${humanFriendlyAmount} ${selectedCoin} (* 1e${token.decimals} = ${totalValue})`);
      let approveResult = await tokenContract.methods.approve(contractAddress, totalValue.toString()).send({ from: selectedAccount })
        .catch(x => {
          error = x;
        })
        .then(x => { 
          return x;
        });

      if (!approveResult) {
        showOrHideError('You must approve 7 ARB in order to mint 1 NFT');
        interactionDone();
        return;
      }
    }

    console.log(`Initiating payment in ${selectedCoin}, token address: ${token.address}`);
    let paymentReceipt = await contract.methods.mint().send({ from: selectedAccount })
      .catch(x => {
        error = x;
      })
      .then(x => { 
        return x;
      });

    if (paymentReceipt) {
      // Payment OK
      console.log(paymentReceipt);
      let transactionUrl = `${CHAIN_INFO[chainId].explorerUrl}/tx/${paymentReceipt.transactionHash}`;
      // TODO: after payment, if you need to call a javascript function to show a success page etc., put it here
      console.log(`THANK YOU. Transaction`, transactionUrl);
    }

    interactionDone();
    
  } catch (e) {
    interactionDone();
    if (!e.message.includes('User denied transaction signature')) {
      console.log('Error: ', e.message);
    }
  }
}

function interactionInProgress() {
  // show loading indicator and hide mint button
  $('#btn-mint').prop('disabled', true);
  $("#loading").show();
}

function interactionDone() {
  // $('#preview').html('').hide();
  $("#loading").hide();
  $('#btn-mint').prop('disabled', false);
}

window.addEventListener('load', async () => {
  init();
  document.querySelector("#btn-connect").addEventListener("click", async () => {
    await onConnect(fetchAccountData);
  });
  document.querySelector("#btn-mint").addEventListener("click", mint);
});
