// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract UserWallet {
    address public owner;
    uint256 public nonce;

    function initialize(address _owner) external {
        require(owner == address(0), "Already initialized");
        owner = _owner;
    }

    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        uint256 providedNonce,
        bytes calldata signature
    ) external payable {
        require(providedNonce == nonce, "UserWallet: Invalid nonce");

        bytes32 hash = keccak256(
            abi.encodePacked(address(this), to, value, data, nonce)
        );

        address signer = _recover(hash, signature);
        require(signer == owner, "UserWallet: Invalid signature");

        unchecked { ++nonce; }

        (bool ok, ) = to.call{value: value}(data);
        require(ok, "UserWallet: Call execution failed");
    }

    function _recover(bytes32 hash, bytes calldata sig) internal pure returns (address signer) {
        if (sig.length != 65) return address(0);
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        return ecrecover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)), v, r, s);
    }

    receive() external payable {}
}