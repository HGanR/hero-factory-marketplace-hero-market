// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./TrooNFTCollection.sol";

/**
 * @title TrooNFTFactory
 * @dev Deploys creator-owned NFT collections with platform fee configuration
 */
contract TrooNFTFactory is Ownable {
    address public platformWallet;
    uint96 public platformFeeBps;
    uint256 public deploymentFee;

    event CollectionDeployed(
        address indexed collection,
        address indexed creator,
        string name,
        string symbol,
        uint256 mintPrice,
        uint96 defaultRoyaltyBps
    );
    event DeploymentFeeUpdated(uint256 oldFee, uint256 newFee);
    event PlatformWalletUpdated(address oldWallet, address newWallet);
    event PlatformFeeUpdated(uint96 oldFee, uint96 newFee);

    constructor(address platformWallet_, uint96 platformFeeBps_, uint256 deploymentFee_) Ownable(msg.sender) {
        require(platformWallet_ != address(0), "Invalid platform wallet");
        require(platformFeeBps_ <= 10000, "Platform fee too high");
        platformWallet = platformWallet_;
        platformFeeBps = platformFeeBps_;
        deploymentFee = deploymentFee_;
    }

    function setDeploymentFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = deploymentFee;
        deploymentFee = newFee;
        emit DeploymentFeeUpdated(oldFee, newFee);
    }

    function setPlatformWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "Invalid platform wallet");
        address oldWallet = platformWallet;
        platformWallet = newWallet;
        emit PlatformWalletUpdated(oldWallet, newWallet);
    }

    function setPlatformFeeBps(uint96 newFee) external onlyOwner {
        require(newFee <= 10000, "Platform fee too high");
        uint96 oldFee = platformFeeBps;
        platformFeeBps = newFee;
        emit PlatformFeeUpdated(oldFee, newFee);
    }

    function createCollection(
        string memory name_,
        string memory symbol_,
        uint256 mintPriceWei,
        uint96 defaultRoyaltyBps
    ) external payable returns (address) {
        require(defaultRoyaltyBps <= 10000, "Royalty too high");
        require(msg.value >= deploymentFee, "Insufficient deployment fee");

        TrooNFTCollection collection = new TrooNFTCollection(
            name_,
            symbol_,
            msg.sender,
            platformWallet,
            platformFeeBps,
            mintPriceWei,
            defaultRoyaltyBps
        );

        if (deploymentFee > 0) {
            (bool platformSuccess, ) = platformWallet.call{value: deploymentFee}("");
            require(platformSuccess, "Deployment fee transfer failed");
        }

        if (msg.value > deploymentFee) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - deploymentFee}("");
            require(refundSuccess, "Refund failed");
        }

        emit CollectionDeployed(address(collection), msg.sender, name_, symbol_, mintPriceWei, defaultRoyaltyBps);
        return address(collection);
    }
}
