import React, { useState } from 'react';
import { Product } from '../types';
import { ShoppingBag, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { WHATSAPP_NUMBER } from '../constants';

interface ProductCardProps {
  product: Product;
  isSellerView: boolean;
  onDelete?: (id: string) => void;
  currentUser?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  isSellerView, 
  onDelete, 
  currentUser 
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Safety check for images
  const images = Array.isArray(product.images) ? product.images : [];

  const handleBuyNow = () => {
    const message = `hi im interested in your product: "${product.name}"`;
    const url = `https://wa.me/${WHATSAPP_NUMBER.replace('+', '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (images.length > 1) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (images.length > 1) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  // Ensure Naira formatting
  const formatPrice = (price: string) => {
    if (!price) return '₦0';
    if (price.includes('₦')) return price;
    if (price.includes('$')) return price.replace('$', '₦');
    // Basic check to see if it's just a number
    if (/^\d/.test(price)) return `₦${price}`;
    return price;
  };

  const isOwner = isSellerView && currentUser === product.seller_username;

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 flex flex-col h-full hover:shadow-lg transition-shadow duration-300">
      {/* Image Carousel */}
      <div className="relative h-48 sm:h-56 bg-gray-100 group">
        {images.length > 0 ? (
          <img 
            src={images[currentImageIndex]} 
            alt={product.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No Image
          </div>
        )}
        
        {images.length > 1 && (
          <>
            <button 
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1">
              {images.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`w-1.5 h-1.5 rounded-full ${idx === currentImageIndex ? 'bg-white' : 'bg-white/50'}`}
                />
              ))}
            </div>
          </>
        )}
        
        <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
           {formatPrice(product.price)}
        </div>
      </div>

      <div className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold text-gray-800 line-clamp-1" title={product.name}>{product.name}</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4 line-clamp-2 flex-grow" title={product.description}>
          {product.description}
        </p>
        
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            Seller: <span className="font-medium text-gray-600">{product.seller_username}</span>
          </span>
          
          {isSellerView ? (
            isOwner && onDelete ? (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(product.id);
                }}
                className="flex items-center space-x-1 text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
              >
                <Trash2 size={16} />
                <span>Remove</span>
              </button>
            ) : null
          ) : (
            <button 
              onClick={handleBuyNow}
              className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm active:transform active:scale-95"
            >
              <ShoppingBag size={16} />
              <span>Buy Now</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};