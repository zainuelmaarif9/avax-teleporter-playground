// Solidity Contract Templates Generator for Teleporter Playground
export function generateSolidityCode(settings) {
  const { messageType, sourceChain, destChain, feeToken } = settings;

  // Constants based on configuration
  const messengerAddress = "0x253b2784c75e510dD0fF1da844684a1aC0aa57df";

  // Generate Sender Contract
  let senderCode = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Interface for Teleporter Messenger contract on Avalanche.
 * Protocol location: ${messengerAddress}
 */
interface ITeleporterMessenger {
    function sendCrossChainMessage(
        bytes32 destinationChainID,
        address destinationAddress,
        bytes calldata message,
        uint256 requiredGasLimit,
        uint256 allowedRelayerReward
    ) external returns (uint256 messageNonce);
}

contract TeleporterSender {
    // Standard Avalanche Teleporter Messenger contract address
    address public constant MESSENGER_ADDRESS = ${messengerAddress};
    ITeleporterMessenger public immutable messenger;

    // Event emitted when a cross-chain teleport is initiated
    event TeleportSent(bytes32 indexed destChainId, address indexed receiver, uint256 nonce);

    constructor() {
        messenger = ITeleporterMessenger(MESSENGER_ADDRESS);
    }
`;

  if (messageType === 'basic') {
    senderCode += `
    /**
     * @notice Sends a simple text message to a receiver contract on another L1 chain.
     * @param destinationChainID The 32-byte representation of the target L1 Chain ID.
     * @param destinationAddress The contract address of the receiver on the target L1.
     * @param messageStr The actual string payload to send.
     */
    function sendStringMessage(
        bytes32 destinationChainID,
        address destinationAddress,
        string calldata messageStr
    ) external payable {
        // Encode the string payload into raw bytes
        bytes memory messageData = abi.encode(messageStr);

        // Required gas for execution on the target chain (e.g. 150k gas)
        uint256 requiredGasLimit = 150000;
        
        // Fee offered to incentivize relayers. ${feeToken === 'AVAX' ? 'Paid in AVAX (msg.value)' : 'Paid using native custom L1 gas token'}
        uint256 relayerFee = ${feeToken === 'AVAX' ? 'msg.value' : '0; // Paid via gas token allowance'};

        uint256 nonce = messenger.sendCrossChainMessage(
            destinationChainID,
            destinationAddress,
            messageData,
            requiredGasLimit,
            relayerFee
        );

        emit TeleportSent(destinationChainID, destinationAddress, nonce);
    }
`;
  } else if (messageType === 'erc20') {
    senderCode += `
    interface IERC20 {
        function transferFrom(address from, address to, uint256 value) external returns (bool);
    }

    address public immutable mockToken;

    constructor(address _token) {
        messenger = ITeleporterMessenger(MESSENGER_ADDRESS);
        mockToken = _token;
    }

    /**
     * @notice Dispatches tokens across subnets using Teleporter.
     */
    function bridgeTokens(
        bytes32 destinationChainID,
        address destinationAddress,
        address recipient,
        uint256 amount
    ) external payable {
        // First lock user tokens in this contract
        IERC20(mockToken).transferFrom(msg.sender, address(this), amount);

        // Encode bridging payload containing recipient and token amount
        bytes memory messageData = abi.encode(recipient, amount);

        uint256 requiredGasLimit = 250000; // Bridging logic takes more gas
        uint256 relayerFee = ${feeToken === 'AVAX' ? 'msg.value' : '0'};

        uint256 nonce = messenger.sendCrossChainMessage(
            destinationChainID,
            destinationAddress,
            messageData,
            requiredGasLimit,
            relayerFee
        );

        emit TeleportSent(destinationChainID, destinationAddress, nonce);
    }
`;
  } else {
    // Custom Struct
    senderCode += `
    // Define structural schema matching the target contract definition
    struct TeleportTask {
        uint256 taskId;
        address creator;
        string dataPayload;
        uint256 executionTimestamp;
    }

    uint256 public taskCounter;

    /**
     * @notice Dispatches complex multi-parameter transaction structs to destination L1.
     */
    function sendComplexTask(
        bytes32 destinationChainID,
        address destinationAddress,
        string calldata taskData
    ) external payable {
        taskCounter++;
        
        // Populate struct schema
        TeleportTask memory task = TeleportTask({
            taskId: taskCounter,
            creator: msg.sender,
            dataPayload: taskData,
            executionTimestamp: block.timestamp
        });

        // Encode the structured packet data
        bytes memory messageData = abi.encode(task);

        uint256 requiredGasLimit = 350000;
        uint256 relayerFee = ${feeToken === 'AVAX' ? 'msg.value' : '0'};

        uint256 nonce = messenger.sendCrossChainMessage(
            destinationChainID,
            destinationAddress,
            messageData,
            requiredGasLimit,
            relayerFee
        );

        emit TeleportSent(destinationChainID, destinationAddress, nonce);
    }
`;
  }

  senderCode += `}`;

  // Generate Receiver Contract
  let receiverCode = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Interchain interface representing Teleporter receiver functionality.
 */
interface ITeleporterReceiver {
    /**
     * @notice Receives a message from the TeleporterMessenger.
     * @param originChainID The 32-byte source L1 identifier.
     * @param originSenderAddress The contract/EOA address that sent the message.
     * @param message The raw bytes payload.
     */
    function receiveTeleporterMessage(
        bytes32 originChainID,
        address originSenderAddress,
        bytes calldata message
    ) external;
}

contract TeleporterReceiver is ITeleporterReceiver {
    // Teleporter Messenger address on target chain
    address public constant MESSENGER_ADDRESS = ${messengerAddress};
    
    // Store variables for state validation
    address public allowedSender;
    bytes32 public allowedOriginChain;

    // Events emitted on execution
    event MessageReceived(bytes32 indexed originChain, address indexed sender, bytes payload);
    event BasicMessageProcessed(string text);

    modifier onlyMessenger() {
        require(msg.sender == MESSENGER_ADDRESS, "TeleporterReceiver: Unauthorized caller");
        _;
    }

    modifier onlyAllowedOrigin(bytes32 originChainID, address originSenderAddress) {
        require(originChainID == allowedOriginChain, "TeleporterReceiver: Invalid origin L1 chain");
        require(originSenderAddress == allowedSender, "TeleporterReceiver: Unauthorized remote sender");
        _;
    }

    constructor(bytes32 _originChain, address _sender) {
        allowedOriginChain = _originChain;
        allowedSender = _sender;
    }
`;

  if (messageType === 'basic') {
    receiverCode += `
    // State storage for simulation message
    string public latestMessageString;

    /**
     * @dev Implements interface method. Decodes and stores the string message.
     */
    function receiveTeleporterMessage(
        bytes32 originChainID,
        address originSenderAddress,
        bytes calldata message
    ) external override onlyMessenger onlyAllowedOrigin(originChainID, originSenderAddress) {
        // Decode string from payload
        string memory receivedString = abi.decode(message, (string));
        
        latestMessageString = receivedString;
        
        emit BasicMessageProcessed(receivedString);
        emit MessageReceived(originChainID, originSenderAddress, message);
    }
`;
  } else if (messageType === 'erc20') {
    receiverCode += `
    interface IMintableERC20 {
        function mint(address to, uint256 value) external;
    }

    address public immutable localToken;

    constructor(bytes32 _originChain, address _sender, address _localToken) {
        allowedOriginChain = _originChain;
        allowedSender = _sender;
        localToken = _localToken;
    }

    /**
     * @dev Process token bridges. Mints equivalent local tokens representing wrapped value.
     */
    function receiveTeleporterMessage(
        bytes32 originChainID,
        address originSenderAddress,
        bytes calldata message
    ) external override onlyMessenger onlyAllowedOrigin(originChainID, originSenderAddress) {
        // Decode recipient address and bridged amount
        (address recipient, uint256 amount) = abi.decode(message, (address, uint256));
        
        // Mint local wrapper asset representational value
        IMintableERC20(localToken).mint(recipient, amount);
        
        emit MessageReceived(originChainID, originSenderAddress, message);
    }
`;
  } else {
    // Custom Struct
    receiverCode += `
    struct TeleportTask {
        uint256 taskId;
        address creator;
        string dataPayload;
        uint256 executionTimestamp;
    }

    // Keep log of executed remote tasks
    mapping(uint256 => TeleportTask) public remoteTasks;

    event TaskExecuted(uint256 indexed taskId, address creator, string payload);

    /**
     * @dev Receives complex payload struct, decodes and processes internal logic.
     */
    function receiveTeleporterMessage(
        bytes32 originChainID,
        address originSenderAddress,
        bytes calldata message
    ) external override onlyMessenger onlyAllowedOrigin(originChainID, originSenderAddress) {
        // Decode the struct from raw bytes
        TeleportTask memory task = abi.decode(message, (TeleportTask));
        
        // Perform state storage/modifications
        remoteTasks[task.taskId] = task;
        
        emit TaskExecuted(task.taskId, task.creator, task.dataPayload);
        emit MessageReceived(originChainID, originSenderAddress, message);
    }
`;
  }

  receiverCode += `}`;

  return {
    sender: senderCode,
    receiver: receiverCode
  };
}

// Simple Helper to syntax highlight code with HTML tags
export function syntaxHighlightSolidity(code) {
  return code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\/\/(.*)/g, '<span class="syn-comment">//$1</span>')
    .replace(/\/\*([\s\S]*?)\*\//g, '<span class="syn-comment">/*$1*/</span>')
    .replace(/(pragma solidity|contract|interface|constructor|function|external|public|immutable|constant|payable|returns|override|require|emit|event|struct|mapping|modifier)/g, '<span class="syn-keyword">$1</span>')
    .replace(/(address|uint256|bytes|bytes32|string|bool)/g, '<span class="syn-type">$1</span>')
    .replace(/("[^"]*")/g, '<span class="syn-string">$1</span>')
    .replace(/(msg\.value|msg\.sender|block\.timestamp)/g, '<span class="syn-builtin">$1</span>')
    .replace(/(\b\d+\b)/g, '<span class="syn-number">$1</span>');
}
