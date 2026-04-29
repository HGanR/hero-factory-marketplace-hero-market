// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";

/**
 * @title TrooMarketplace
 * @dev NFT marketplace with built-in platform fees and royalty distribution
 * Supports token holder discounts for TROO token holders
 */
contract TrooMarketplace is ReentrancyGuard, Ownable {
    // Platform wallet that receives fees
    address public platformWallet;
    
    // Platform fee in basis points (250 = 2.5%)
    uint256 public platformFee = 250;
    
    // Discounted fee for TROO token holders (150 = 1.5%)
    uint256 public discountedFee = 150;
    
    // TROO token address (optional, for fee discounts)
    address public trooTokenAddress;
    
    // Minimum TROO tokens required for discount
    uint256 public minTrooBalance = 10_000_000 * 10**18; // 10M TROO
    
    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;
        bool active;
    }
    
    // Mapping from listing ID to Listing
    mapping(uint256 => Listing) public listings;
    uint256 public listingCounter;
    
    // Events
    event Listed(
        uint256 indexed listingId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 price
    );
    
    event Sold(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 price,
        uint256 platformFeeAmount,
        uint256 royaltyAmount
    );
    
    event ListingCancelled(uint256 indexed listingId);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event DiscountedFeeUpdated(uint256 oldFee, uint256 newFee);
    
    constructor(
        address _platformWallet,
        address _trooTokenAddress
    ) Ownable(msg.sender) {
        require(_platformWallet != address(0), "Invalid platform wallet");
        platformWallet = _platformWallet;
        trooTokenAddress = _trooTokenAddress;
    }
    
    /**
     * @dev List an NFT for sale
     */
    function listNFT(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) external nonReentrant returns (uint256) {
        require(price > 0, "Price must be greater than 0");
        
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(
            nft.isApprovedForAll(msg.sender, address(this)) ||
            nft.getApproved(tokenId) == address(this),
            "Marketplace not approved"
        );
        
        uint256 listingId = listingCounter++;
        listings[listingId] = Listing({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            active: true
        });
        
        emit Listed(listingId, msg.sender, nftContract, tokenId, price);
        
        return listingId;
    }
    
    /**
     * @dev Buy an NFT from the marketplace
     */
    function buyNFT(uint256 listingId) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(msg.value >= listing.price, "Insufficient payment");
        
        // Calculate fees
        uint256 applicableFee = _getApplicableFee(msg.sender);
        uint256 platformFeeAmount = (listing.price * applicableFee) / 10000;
        
        // Get royalty info
        (address royaltyReceiver, uint256 royaltyAmount) = _getRoyaltyInfo(
            listing.nftContract,
            listing.tokenId,
            listing.price
        );
        
        // Calculate seller proceeds
        uint256 sellerProceeds = listing.price - platformFeeAmount - royaltyAmount;
        
        // Mark listing as inactive
        listing.active = false;
        
        // Transfer NFT to buyer
        IERC721(listing.nftContract).safeTransferFrom(
            listing.seller,
            msg.sender,
            listing.tokenId
        );
        
        // Distribute funds
        (bool platformSuccess, ) = platformWallet.call{value: platformFeeAmount}("");
        require(platformSuccess, "Platform fee transfer failed");
        
        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            (bool royaltySuccess, ) = royaltyReceiver.call{value: royaltyAmount}("");
            require(royaltySuccess, "Royalty transfer failed");
        }
        
        (bool sellerSuccess, ) = listing.seller.call{value: sellerProceeds}("");
        require(sellerSuccess, "Seller payment failed");
        
        // Refund excess payment
        if (msg.value > listing.price) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - listing.price}("");
            require(refundSuccess, "Refund failed");
        }
        
        emit Sold(
            listingId,
            msg.sender,
            listing.seller,
            listing.price,
            platformFeeAmount,
            royaltyAmount
        );
    }
    
    /**
     * @dev Cancel a listing
     */
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(listing.seller == msg.sender, "Not the seller");
        
        listing.active = false;
        
        emit ListingCancelled(listingId);
    }
    
    /**
     * @dev Get applicable fee based on TROO token balance
     */
    function _getApplicableFee(address buyer) internal view returns (uint256) {
        if (trooTokenAddress == address(0)) {
            return platformFee;
        }
        
        IERC20 trooToken = IERC20(trooTokenAddress);
        if (trooToken.balanceOf(buyer) >= minTrooBalance) {
            return discountedFee;
        }
        
        return platformFee;
    }
    
    /**
     * @dev Get royalty info from NFT contract (ERC2981)
     */
    function _getRoyaltyInfo(
        address nftContract,
        uint256 tokenId,
        uint256 salePrice
    ) internal view returns (address receiver, uint256 royaltyAmount) {
        try ERC2981(nftContract).royaltyInfo(tokenId, salePrice) returns (
            address _receiver,
            uint256 _royaltyAmount
        ) {
            return (_receiver, _royaltyAmount);
        } catch {
            return (address(0), 0);
        }
    }
    
    /**
     * @dev Update platform fee (only owner)
     */
    function setPlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee too high"); // Max 10%
        uint256 oldFee = platformFee;
        platformFee = newFee;
        emit PlatformFeeUpdated(oldFee, newFee);
    }
    
    /**
     * @dev Update discounted fee (only owner)
     */
    function setDiscountedFee(uint256 newFee) external onlyOwner {
        require(newFee <= platformFee, "Discounted fee must be lower");
        uint256 oldFee = discountedFee;
        discountedFee = newFee;
        emit DiscountedFeeUpdated(oldFee, newFee);
    }
    
    /**
     * @dev Update platform wallet (only owner)
     */
    function setPlatformWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "Invalid wallet");
        platformWallet = newWallet;
    }
    
    /**
     * @dev Update TROO token address (only owner)
     */
    function setTrooTokenAddress(address newAddress) external onlyOwner {
        trooTokenAddress = newAddress;
    }
    
    /**
     * @dev Update minimum TROO balance for discount (only owner)
     */
    function setMinTrooBalance(uint256 newBalance) external onlyOwner {
        minTrooBalance = newBalance;
    }
}
