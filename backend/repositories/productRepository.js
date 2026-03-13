const products = []; // Simulated database

/**
 * Find all products
 */
const findAll = () => {
    return products;
};

/**
 * Find a product by its ID
 */
const findById = (id) => {
    return products.find(product => product.id === id);
};

/**
 * Find a product by its SKU
 */
const findBySku = (sku) => {
    return products.find(product => product.sku === sku);
};

/**
 * Create a new product
 */
const create = (product) => {
    products.push(product);
    return product;
};

/**
 * Update an existing product
 */
const update = (id, updatedProduct) => {
    const index = products.findIndex(product => product.id === id);
    if (index !== -1) {
        products[index] = {...products[index], ...updatedProduct};
        return products[index];
    }
    return null;
};

/**
 * Delete a product by ID
 */
const deleteProduct = (id) => {
    const index = products.findIndex(product => product.id === id);
    if (index !== -1) {
        return products.splice(index, 1);
    }
    return null;
};

/**
 * Update stock quantity of a product
 */
const updateStock = (id, quantity) => {
    const product = findById(id);
    if (product) {
        product.stock = quantity;
        return product;
    }
    return null;
};

/**
 * Find products with low stock
 */
const findLowStockProducts = (threshold) => {
    return products.filter(product => product.stock < threshold);
};

/**
 * Get product statistics
 */
const getProductStats = () => {
    return {
        totalProducts: products.length,
        totalStock: products.reduce((acc, product) => acc + product.stock, 0),
        avgPrice: products.reduce((acc, product) => acc + product.price, 0) / products.length || 0,
    };
};

module.exports = { findAll, findById, findBySku, create, update, deleteProduct, updateStock, findLowStockProducts, getProductStats };