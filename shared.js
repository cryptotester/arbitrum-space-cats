const WalletConnectProvider = window.WalletConnectProvider.default;
const Web3Modal = window.Web3Modal.default;
const Web3 = window.Web3;

// const INFURA_KEY = "cc8e039138de4821a899502d06eb42d7" // binarypunks infura key

// This is to add WalletConnect to the options
const providerOptions = {
  walletconnect: {
    package: WalletConnectProvider,
    // options: {
    //   infuraId: INFURA_KEY,
    // }
  },
};

const CHAIN = {
  // 1: {
  //   name: 'Ethereum',
  //   rpc: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
  // },
  250: {
    name: 'Fantom Opera',
    rpc: 'https://rpc.fantom.network/',
  },
  4002: {
    name: 'Fantom Testnet',
    rpc: 'https://rpc.testnet.fantom.network/'
  },
  41: {
    name: 'Telos Testnet',
    rpc: 'https://testnet.telos.net/evm'
  },
  42161: {
    name: 'Arbitrum One',
    rpc: 'https://testnet.telos.net/evm'
  },
}

function init() {
  // console.log("window.web3 is", window.web3, "window.ethereum is", window.ethereum);

  if(location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    const alert = document.querySelector("#alert-error-https");
    document.querySelector("#btn-connect").setAttribute("disabled", "disabled")
    return;
  }

  window.web3Modal = new Web3Modal({
    cacheProvider: false,
    providerOptions,
    disableInjectedProvider: false, // optional. For MetaMask / Brave / Opera.
  });
}

async function getContract(chainId, ABI, CONTRACT_ADDRESS) {
  let rpcAddress = CHAIN[chainId].rpc;
  let _web3 = new Web3(new Web3.providers.HttpProvider(rpcAddress));
  return await new _web3.eth.Contract(ABI, CONTRACT_ADDRESS);
}

async function updateMintInfo(chainId, ABI, CONTRACT_ADDRESS) {
  // TODO: fetch NFTs owned by the user rather than mint Info here
  let mintCount = "?";
  // try {
  //   let _contract = await getContract(chainId, ABI, CONTRACT_ADDRESS);
  //   console.log(`Checking contract ${CONTRACT_ADDRESS} (chainId: ${chainId})`);
  //   await _contract.methods.mintCount().call().then(x => {
  //     mintCount = x;
  //     document.querySelector("#mintCount").innerHTML = mintCount;
  //     // console.log(`(Public provider) mintCount: ${mintCount}`);
  //   });
  // } catch (e) {
  //   console.log("updateMintInfo failed:", e.message);
  // }
  return mintCount;
}

function showOrHideError(disableReason = undefined) {
  if (disableReason === undefined) {
    // No reason given = hide error
    document.querySelector("#error-message").style.display = "none";
  } else {
    document.querySelector("#error-message").innerHTML = disableReason;
    document.querySelector("#error-message").style.display = "block";
  }
}

async function _refreshAccountData(fetchAccountDataFn) {
  // console.log('fetchAccountDataFn', fetchAccountDataFn);
  document.querySelector("#connected").style.display = "none";
  document.querySelector("#prepare").style.display = "block";

  document.querySelector("#btn-connect").setAttribute("disabled", "disabled");
  await fetchAccountDataFn();
  document.querySelector("#btn-connect").removeAttribute("disabled");
}

async function onConnect(fetchAccountDataFn, afterFn) {
  try {
    window.provider = await window.web3Modal.connect();
  } catch(e) {
    console.log("Could not get a wallet connection", e);
    return;
  }

  window.provider.on("accountsChanged", (accounts) => {
    fetchAccountDataFn();
  });

  // window.provider.on("networkChanged", (networkId) => {
  //   fetchAccountDataFn();
  // });

  await _refreshAccountData(fetchAccountDataFn);
}

async function switchNetwork(web3, chainId) {
  let currentChainId = await web3.eth.getChainId();
  if (currentChainId != chainId) {
    console.log('currentChainId & chainId to switch to:', currentChainId, chainId);
    let networkName = CHAIN[chainId].name;
    try {
      console.log(`Trying to switch to ${networkName} (${chainId})`);
      await web3.currentProvider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${(chainId).toString(16)}` }]
      });
      // console.log(`Switched to ${chainId}`);
    } catch (error) {
      showOrHideError(`Please switch to ${networkName}`);
    }
  } else {
    // console.log('Already connected to the proper network.');
  }
}

async function handleLowBalance(web3, selectedAccount, expectedAmount, lowBalanceMessage, tokenContract) {
  let BN = web3.utils.toBN;
  let amountInBaseCoin, userBalance;
  if (!tokenContract) {
    // Native coin balance check
    amountInBaseCoin = web3.utils.fromWei(expectedAmount.toString());
    // console.log(`Amount in base coin ${amountInBaseCoin}`);
    userBalance = await web3.eth.getBalance(selectedAccount);
  } else {
    // ERC20 token balance check
    userBalance = await tokenContract.methods.balanceOf(selectedAccount).call();
    // console.log(`userBalance: ${userBalance}`);
    let decimals = await tokenContract.methods.decimals().call();    
    let balanceInBaseCoin = parseFloat(userBalance) / parseFloat(10 ** decimals);
    amountInBaseCoin = parseFloat(expectedAmount) / parseFloat(10 ** decimals);
    console.log(`Token Balance: ${balanceInBaseCoin.toFixed(4)}`);
  }
  // let balanceInEth = web3.utils.fromWei(userBalance);
  if (BN(userBalance).lt(BN(expectedAmount))) {
    lowBalanceMessage = lowBalanceMessage.replace('[AMOUNT]', amountInBaseCoin.toFixed(4));
    console.log(lowBalanceMessage);
    showOrHideError(lowBalanceMessage);
    return false;
  }
  return true;
}

function getSupportedChainNames(CHAIN_INFO, allowOnlyProdChains = false) {
  let result = [];
  for (const [k, v] of Object.entries(CHAIN_INFO)) {
    if (allowOnlyProdChains && v.isTestnet) continue
    if (v.contractAddress && v.contractAddress != '') result.push(v.name);
  }
  return result;
}

function getParameterByName(name, url = window.location.href) {
  name = name.replace(/[\[\]]/g, '\\$&');
  var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
      results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export {
  CHAIN,
  init,
  getContract,
  updateMintInfo,
  showOrHideError,
  onConnect,
  switchNetwork,
  handleLowBalance,
  getSupportedChainNames,
  getParameterByName,
  sleep,
}