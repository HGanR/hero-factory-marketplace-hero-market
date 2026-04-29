// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TrooNFTCollection
 * @dev Creator-owned collection with platform fee on primary mints
 */
contract TrooNFTCollection is ERC721, ERC721URIStorage, ERC721Royalty, Ownable, ReentrancyGuard {
    uint256 private _tokenIdCounter;

    address public immutable platformWallet;
    uint96 public platformFeeBps;
    uint256 public mintPrice;
    uint96 public defaultRoyaltyBps;

    event Minted(uint256 indexed tokenId, address indexed to, uint256 pricePaid, uint96 royaltyBps);
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event DefaultRoyaltyUpdated(uint96 oldRoyalty, uint96 newRoyalty);

    constructor(
        string memory name_,
        string memory symbol_,
        address creator,
        address platformWallet_,
        uint96 platformFeeBps_,
        uint256 mintPrice_,
        uint96 defaultRoyaltyBps_
    ) ERC721(name_, symbol_) Ownable(creator) {
        require(creator != address(0), "Invalid creator");
        require(platformWallet_ != address(0), "Invalid platform wallet");
        require(platformFeeBps_ <= 10000, "Platform fee too high");
        require(defaultRoyaltyBps_ <= 10000, "Royalty too high");
        platformWallet = platformWallet_;
        platformFeeBps = platformFeeBps_;
        mintPrice = mintPrice_;
        defaultRoyaltyBps = defaultRoyaltyBps_;
    }

    function setMintPrice(uint256 newPrice) external onlyOwner {
        uint256 oldPrice = mintPrice;
        mintPrice = newPrice;
        emit MintPriceUpdated(oldPrice, newPrice);
    }

    function setDefaultRoyaltyBps(uint96 newRoyaltyBps) external onlyOwner {
        require(newRoyaltyBps <= 10000, "Royalty too high");
        uint96 oldRoyalty = defaultRoyaltyBps;
        defaultRoyaltyBps = newRoyaltyBps;
        emit DefaultRoyaltyUpdated(oldRoyalty, newRoyaltyBps);
    }

    function mintTo(address to, string memory uri, uint96 royaltyBps)
        external
        payable
        nonReentrant
        returns (uint256)
    {
        require(to != address(0), "Invalid recipient");
        require(msg.value >= mintPrice, "Insufficient mint price");
        return _mintInternal(to, uri, royaltyBps, msg.value);
    }

    function ownerMintTo(address to, string memory uri, uint96 royaltyBps)
        external
        onlyOwner
        returns (uint256)
    {
        require(to != address(0), "Invalid recipient");
        return _mintInternal(to, uri, royaltyBps, 0);
    }

    function mintBatchTo(address to, string[] memory uris, uint96 royaltyBps)
        external
        payable
        nonReentrant
        returns (uint256[] memory)
    {
        require(to != address(0), "Invalid recipient");
        require(uris.length > 0, "Empty batch");
        uint256 totalPrice = mintPrice * uris.length;
        require(msg.value == totalPrice, "Invalid mint price");

        uint256[] memory tokenIds = new uint256[](uris.length);
        for (uint256 i = 0; i < uris.length; i++) {
            tokenIds[i] = _mintInternal(to, uris[i], royaltyBps, mintPrice);
        }
        return tokenIds;
    }

    function ownerMintBatchTo(address to, string[] memory uris, uint96 royaltyBps)
        external
        onlyOwner
        returns (uint256[] memory)
    {
        require(to != address(0), "Invalid recipient");
        require(uris.length > 0, "Empty batch");

        uint256[] memory tokenIds = new uint256[](uris.length);
        for (uint256 i = 0; i < uris.length; i++) {
            tokenIds[i] = _mintInternal(to, uris[i], royaltyBps, 0);
        }
        return tokenIds;
    }

    function _mintInternal(address to, string memory uri, uint96 royaltyBps, uint256 payment)
        internal
        returns (uint256)
    {
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter += 1;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        uint96 appliedRoyalty = royaltyBps > 0 ? royaltyBps : defaultRoyaltyBps;
        if (appliedRoyalty > 0) {
            _setTokenRoyalty(tokenId, owner(), appliedRoyalty);
        }

        if (payment > 0) {
            uint256 platformFeeAmount = (payment * platformFeeBps) / 10000;
            uint256 creatorAmount = payment - platformFeeAmount;

            (bool platformSuccess, ) = platformWallet.call{value: platformFeeAmount}("");
            require(platformSuccess, "Platform fee transfer failed");

            (bool creatorSuccess, ) = owner().call{value: creatorAmount}("");
            require(creatorSuccess, "Creator payment failed");
        }

        emit Minted(tokenId, to, payment, appliedRoyalty);
        return tokenId;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, ERC721Royalty)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
