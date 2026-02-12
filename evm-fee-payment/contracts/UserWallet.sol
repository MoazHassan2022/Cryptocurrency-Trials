// contracts/UserWallet.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract UserWallet {
    address public owner;
    uint256 public nonce;

    event Executed(address to, uint256 value, bytes data);

    constructor(address _owner) {
        owner = _owner;
        nonce = 0;
    }

    function execute(address to, uint256 value, bytes calldata data, bytes calldata signature) external {
        // Verify user's signature
        bytes32 hash = keccak256(abi.encodePacked(address(this), to, value, data, nonce));
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        require(recoverSigner(ethSignedHash, signature) == owner, "Invalid signature");

        // Increment nonce
        nonce += 1;

        // Execute the call
        (bool success, ) = to.call{value: value}(data);
        require(success, "Call failed");

        emit Executed(to, value, data);
    }

    function recoverSigner(bytes32 hash, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        return ecrecover(hash, v, r, s);
    }

    receive() external payable {}
}
