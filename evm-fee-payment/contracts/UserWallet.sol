// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract UserWallet {
    address public owner;
    uint256 public nonce;

    error InvalidSignature();
    error CallFailed();

    function initialize(address _owner) external {
        owner = _owner;
    }

    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        bytes32 hash,
        bytes calldata signature
    ) external payable {
        address signer = _recover(hash, signature);
        if (signer != owner) revert InvalidSignature();

        unchecked { ++nonce; }

        (bool ok, ) = to.call{value: value}(data);
        if (!ok) revert CallFailed();
    }

    function _recover(bytes32 hash, bytes calldata sig)
        internal
        pure
        returns (address signer)
    {
        if (sig.length != 65) revert InvalidSignature();

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }

        signer = ecrecover(
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
            ),
            v,
            r,
            s
        );
    }

    receive() external payable {}
}