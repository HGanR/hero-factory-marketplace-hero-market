// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TrooNFT
 * @dev NFT contract with built-in minting fees and royalty support
 * Supports Ethereum, Polygon, and Metallicus networks
 */
contract TrooNFT is ERC721, ERC721URIStorage, ERC721Royalty, Ownable {
    uint256 private _tokenIdCounter;
    
    // Platform wallet that receives minting fees
    address public platformWallet;
    
    // Minting fee in wei (0.001 ETH = 1000000000000000 wei)
    uint256 public mintingFee = 0.001 ether;
    
    // Mapping to track token creators
    mapping(uint256 => address) public tokenCreators;
    
    // Events
    event NFTMinted(
        uint256 indexed tokenId,
        address indexed creator,
        address indexed owner,
        string tokenURI,
        uint96 royaltyPercentage
    );
    
    event MintingFeeUpdated(uint256 oldFee, uint256 newFee);
    event PlatformWalletUpdated(address oldWallet, address newWallet);
    
    constructor(
        string memory name,
        string memory symbol,
        address _platformWallet
    ) ERC721(name, symbol) Ownable(msg.sender) {
        require(_platformWallet != address(0), "Invalid platform wallet");
        platformWallet = _platformWallet;
    }
    
    /**
     * @dev Mint a new NFT with royalty support
     * @param to Address to receive the NFT
     * @param uri Metadata URI (IPFS hash)
     * @param royaltyPercentage Royalty percentage (in basis points, e.g., 1000 = 10%)
     */
    function mintNFT(
        address to,
        string memory uri,
        uint96 royaltyPercentage
    ) public payable returns (uint256) {
        require(msg.value >= mintingFee, "Insufficient minting fee");
        require(royaltyPercentage <= 10000, "Royalty too high"); // Max 100%
        
        // Transfer minting fee to platform wallet
        (bool success, ) = platformWallet.call{value: msg.value}("");
        require(success, "Fee transfer failed");
        
        // Mint NFT
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter += 1;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        // Set royalty for creator
        _setTokenRoyalty(tokenId, msg.sender, royaltyPercentage);
        
        // Track creator
        tokenCreators[tokenId] = msg.sender;
        
        emit NFTMinted(tokenId, msg.sender, to, uri, royaltyPercentage);
        
        return tokenId;
    }
    
    /**
     * @dev Update minting fee (only owner)
     */
    function setMintingFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = mintingFee;
        mintingFee = newFee;
        emit MintingFeeUpdated(oldFee, newFee);
    }
    
    /**
     * @dev Update platform wallet (only owner)
     */
    function setPlatformWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "Invalid wallet");
        address oldWallet = platformWallet;
        platformWallet = newWallet;
        emit PlatformWalletUpdated(oldWallet, newWallet);
    }
    
    /**
     * @dev Get total supply of minted NFTs
     */
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }
    
    /**
     * @dev Get creator of a token
     */
    function getCreator(uint256 tokenId) public view returns (address) {
        return tokenCreators[tokenId];
    }
    
    // Required overrides
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
