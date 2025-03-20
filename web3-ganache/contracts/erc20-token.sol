// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";

contract ERC20Token is ERC20, Ownable, ERC20Burnable, ERC20Pausable {
    uint8 private _customDecimals;

    constructor(string memory name, string memory symbol, address owner, address recipient, uint256 initialSupply, uint8 decimals_) 
    ERC20(name, symbol) 
    Ownable(owner)
    {
        _customDecimals = decimals_; // read about decimals for interpretation of floating point tokens
        // give initial supply to recipient
        _mint(recipient, initialSupply);
    }

    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }

    // to be mintable
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    // to be pausable
    function pause() public onlyOwner {
        _pause();
    }

    // to be pausable
    function unpause() public onlyOwner {
        _unpause();
    }

    // to be pausable
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}