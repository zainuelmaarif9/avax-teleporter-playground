import { TeleporterSimulator } from './simulator.js';
import { generateSolidityCode, syntaxHighlightSolidity } from './codegen.js';
import { calculateRetroRewards } from './calculator.js';

// Application State
const state = {
  chains: [
    { id: 'c_chain', name: 'C-Chain', token: 'AVAX', isSystem: true },
    { id: 'gaming_l1', name: 'Gaming L1', token: 'GAME', isSystem: false },
    { id: 'defi_l1', name: 'DeFi L1', token: 'GOLD', isSystem: false }
  ],
  sourceId: 'c_chain',
  destId: 'gaming_l1',
  messageType: 'basic',
  validators: 12,
  feeToken: 'AVAX',
  activeTab: 'code', // 'code' or 'calc'
  activeCodeContract: 'sender', // 'sender' or 'receiver'
  totalSimulatedBurn: 0.00,
  
  // Calculator Inputs
  calcVolume: 5000,
  calcGas: 150000,
  calcAvaxPrice: 35
};

// SVG Simulator Reference
let simulator;

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Simulator
  simulator = new TeleporterSimulator('simulation-svg', 'canvas-container');
  simulator.setChains(state.chains);
  simulator.setSourceAndDest(state.sourceId, state.destId);
  simulator.setValidators(state.validators);

  // 2. Bind Simulator Callbacks
  simulator.onStepChange = (stepIndex) => {
    // console.log("Sim step transition: ", stepIndex);
  };

  simulator.onSimulationComplete = () => {
    document.getElementById('btn-play-sim').disabled = false;
    document.getElementById('btn-reset-sim').disabled = false;
  };

  simulator.onBurnUpdate = () => {
    // Increments simulated AVAX burn metrics
    // Teleporter messages typically burn minor amounts of gas on both chains.
    // We add a randomized realistic burn between 0.045 and 0.095 AVAX
    const increment = 0.045 + Math.random() * 0.05;
    state.totalSimulatedBurn += increment;
    
    const burnEl = document.getElementById('stat-total-burn');
    burnEl.textContent = `${state.totalSimulatedBurn.toFixed(3)} AVAX`;
    burnEl.style.animation = 'none';
    setTimeout(() => {
      burnEl.style.animation = 'pulse-border 1.5s ease-out';
    }, 10);
  };

  // 3. Initialize Elements & Event Listeners
  initUIElements();
  updateSolidityCode();
  updateCalculatorResults();
  renderSubnetsList();
});

function initUIElements() {
  // Elements
  const paramMsgType = document.getElementById('param-msg-type');
  const paramSource = document.getElementById('param-source');
  const paramDest = document.getElementById('param-dest');
  const paramValidators = document.getElementById('param-validators');
  const valValidatorCount = document.getElementById('val-validator-count');
  const paramFeeToken = document.getElementById('param-fee-token');

  // Trigger Sim Button
  const btnPlaySim = document.getElementById('btn-play-sim');
  const btnResetSim = document.getElementById('btn-reset-sim');

  // Tab Buttons
  const tabBtnCode = document.getElementById('tab-btn-code');
  const tabBtnCalc = document.getElementById('tab-btn-calc');
  const tabContentCode = document.getElementById('tab-content-code');
  const tabContentCalc = document.getElementById('tab-content-calc');

  // Code toggle button groups
  const codeToggleSender = document.getElementById('code-toggle-sender');
  const codeToggleReceiver = document.getElementById('code-toggle-receiver');
  const btnCopyCode = document.getElementById('btn-copy-code');

  // Calculator inputs
  const calcTxVolume = document.getElementById('calc-tx-volume');
  const valTxVolume = document.getElementById('val-tx-volume');
  const calcAvgGas = document.getElementById('calc-avg-gas');
  const valAvgGas = document.getElementById('val-avg-gas');
  const calcAvaxPrice = document.getElementById('calc-avax-price');
  const valAvaxPrice = document.getElementById('val-avax-price');

  // Modal elements for new Subnet
  const btnAddSubnet = document.getElementById('btn-add-subnet');
  const modalAddSubnet = document.getElementById('modal-add-subnet');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalConfirmBtn = document.getElementById('modal-confirm-btn');
  const modalSubnetName = document.getElementById('modal-subnet-name');
  const modalSubnetToken = document.getElementById('modal-subnet-token');

  // ----------------------------------------------------
  // Bind Select Options dynamically
  // ----------------------------------------------------
  populateChainDropdowns();

  paramMsgType.addEventListener('change', (e) => {
    state.messageType = e.target.value;
    updateSolidityCode();
  });

  paramSource.addEventListener('change', (e) => {
    state.sourceId = e.target.value;
    // Prevent source and dest being identical
    if (state.sourceId === state.destId) {
      const nextDest = state.chains.find(c => c.id !== state.sourceId);
      state.destId = nextDest.id;
      paramDest.value = nextDest.id;
    }
    simulator.setSourceAndDest(state.sourceId, state.destId);
    updateSolidityCode();
  });

  paramDest.addEventListener('change', (e) => {
    state.destId = e.target.value;
    if (state.destId === state.sourceId) {
      const nextSource = state.chains.find(c => c.id !== state.destId);
      state.sourceId = nextSource.id;
      paramSource.value = nextSource.id;
    }
    simulator.setSourceAndDest(state.sourceId, state.destId);
    updateSolidityCode();
  });

  paramValidators.addEventListener('input', (e) => {
    state.validators = e.target.value;
    valValidatorCount.textContent = `${state.validators} nodes`;
    simulator.setValidators(state.validators);
  });

  paramFeeToken.addEventListener('change', (e) => {
    state.feeToken = e.target.value;
    updateSolidityCode();
  });

  // ----------------------------------------------------
  // Sim buttons
  // ----------------------------------------------------
  btnPlaySim.addEventListener('click', () => {
    btnPlaySim.disabled = true;
    btnResetSim.disabled = false;
    simulator.startSimulation();
  });

  btnResetSim.addEventListener('click', () => {
    simulator.resetSimulation();
    btnResetSim.disabled = true;
    btnPlaySim.disabled = false;
  });

  // ----------------------------------------------------
  // Tab Controls
  // ----------------------------------------------------
  tabBtnCode.addEventListener('click', () => {
    tabBtnCode.classList.add('active');
    tabBtnCalc.classList.remove('active');
    tabContentCode.classList.add('active');
    tabContentCalc.classList.remove('active');
    state.activeTab = 'code';
  });

  tabBtnCalc.addEventListener('click', () => {
    tabBtnCalc.classList.add('active');
    tabBtnCode.classList.remove('active');
    tabContentCalc.classList.add('active');
    tabContentCode.classList.remove('active');
    state.activeTab = 'calc';
  });

  // ----------------------------------------------------
  // Code Toggle controls
  // ----------------------------------------------------
  codeToggleSender.addEventListener('click', () => {
    codeToggleSender.classList.add('active');
    codeToggleReceiver.classList.remove('active');
    state.activeCodeContract = 'sender';
    updateSolidityCode();
  });

  codeToggleReceiver.addEventListener('click', () => {
    codeToggleReceiver.classList.add('active');
    codeToggleSender.classList.remove('active');
    state.activeCodeContract = 'receiver';
    updateSolidityCode();
  });

  btnCopyCode.addEventListener('click', () => {
    const rawCode = document.getElementById('code-display').innerText;
    navigator.clipboard.writeText(rawCode).then(() => {
      const origText = btnCopyCode.innerHTML;
      btnCopyCode.innerHTML = '✓ Copied!';
      setTimeout(() => {
        btnCopyCode.innerHTML = origText;
      }, 1500);
    });
  });

  // ----------------------------------------------------
  // Calculator Controls
  // ----------------------------------------------------
  calcTxVolume.addEventListener('input', (e) => {
    state.calcVolume = parseInt(e.target.value);
    valTxVolume.textContent = `${state.calcVolume.toLocaleString()} txs`;
    updateCalculatorResults();
  });

  calcAvgGas.addEventListener('input', (e) => {
    state.calcGas = parseInt(e.target.value);
    valAvgGas.textContent = `${state.calcGas.toLocaleString()} gas`;
    updateCalculatorResults();
  });

  calcAvaxPrice.addEventListener('input', (e) => {
    state.calcAvaxPrice = parseFloat(e.target.value);
    valAvaxPrice.textContent = `$${state.calcAvaxPrice.toFixed(2)}`;
    updateCalculatorResults();
  });

  // ----------------------------------------------------
  // Deploy Custom L1 Modal Controls
  // ----------------------------------------------------
  btnAddSubnet.addEventListener('click', () => {
    modalAddSubnet.style.display = 'flex';
    modalSubnetName.focus();
  });

  modalCancelBtn.addEventListener('click', () => {
    modalAddSubnet.style.display = 'none';
    modalSubnetName.value = '';
    modalSubnetToken.value = '';
  });

  modalConfirmBtn.addEventListener('click', () => {
    const name = modalSubnetName.value.trim();
    const token = modalSubnetToken.value.trim().toUpperCase();

    if (!name || !token) {
      alert("Please provide both a blockchain name and a gas token symbol.");
      return;
    }

    const newId = `custom_l1_${Date.now()}`;
    const newChain = { id: newId, name, token, isSystem: false };
    
    state.chains.push(newChain);
    
    // Update dashboard statistics count
    document.getElementById('stat-active-subnets').textContent = state.chains.length;

    // Refresh UI
    populateChainDropdowns();
    renderSubnetsList();
    simulator.setChains(state.chains);
    
    // Close Modal
    modalAddSubnet.style.display = 'none';
    modalSubnetName.value = '';
    modalSubnetToken.value = '';
  });
}

function populateChainDropdowns() {
  const paramSource = document.getElementById('param-source');
  const paramDest = document.getElementById('param-dest');

  paramSource.innerHTML = '';
  paramDest.innerHTML = '';

  state.chains.forEach(chain => {
    const optSrc = document.createElement('option');
    optSrc.value = chain.id;
    optSrc.textContent = `${chain.name} (${chain.token})`;
    paramSource.appendChild(optSrc);

    const optDst = document.createElement('option');
    optDst.value = chain.id;
    optDst.textContent = `${chain.name} (${chain.token})`;
    paramDest.appendChild(optDst);
  });

  paramSource.value = state.sourceId;
  paramDest.value = state.destId;
}

function renderSubnetsList() {
  const subnetsList = document.getElementById('subnets-list');
  subnetsList.innerHTML = '';

  state.chains.forEach(chain => {
    const card = document.createElement('div');
    card.className = 'subnet-item-card';

    const info = document.createElement('div');
    info.className = 'subnet-info';

    const name = document.createElement('span');
    name.className = 'subnet-name';
    name.textContent = chain.name;
    info.appendChild(name);

    const gas = document.createElement('span');
    gas.className = 'subnet-gas';
    gas.textContent = `Gas: ${chain.token}`;
    info.appendChild(gas);

    card.appendChild(info);

    // Only allow deleting non-system chains
    if (!chain.isSystem) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'subnet-action-btn';
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      deleteBtn.addEventListener('click', () => {
        removeChain(chain.id);
      });
      card.appendChild(deleteBtn);
    }

    subnetsList.appendChild(card);
  });
}

function removeChain(chainId) {
  // Validate that we're not deleting active source or destination
  if (state.sourceId === chainId || state.destId === chainId) {
    alert("Cannot delete a chain that is currently selected as a Source or Destination.");
    return;
  }

  state.chains = state.chains.filter(c => c.id !== chainId);
  document.getElementById('stat-active-subnets').textContent = state.chains.length;

  populateChainDropdowns();
  renderSubnetsList();
  simulator.setChains(state.chains);
}

function updateSolidityCode() {
  const sourceNode = state.chains.find(c => c.id === state.sourceId);
  const destNode = state.chains.find(c => c.id === state.destId);

  const configs = {
    messageType: state.messageType,
    sourceChain: sourceNode ? sourceNode.name : 'C-Chain',
    destChain: destNode ? destNode.name : 'Subnet',
    feeToken: state.feeToken
  };

  const codes = generateSolidityCode(configs);
  const selectedCode = state.activeCodeContract === 'sender' ? codes.sender : codes.receiver;
  
  const display = document.getElementById('code-display');
  // Use innerHTML with formatting classes
  display.innerHTML = syntaxHighlightSolidity(selectedCode);
}

function updateCalculatorResults() {
  const result = calculateRetroRewards(state.calcVolume, state.calcGas, state.calcAvaxPrice);

  document.getElementById('calc-out-burn').textContent = result.annualAvaxBurned.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  document.getElementById('calc-out-rebate').textContent = `$${Math.round(result.annualDeveloperRebateUsd).toLocaleString()}`;

  document.getElementById('calc-out-savings').textContent = result.savingsPercentage.toFixed(1);
}
