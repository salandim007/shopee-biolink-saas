const CATEGORY_MAP = {
    'Audio': 'Áudio',
    'Automobiles': 'Automóveis',
    'Baby & Kids Fashion': 'Moda Infantil',
    'Beauty': 'Beleza',
    'Books & Magazines': 'Livros e Revistas',
    'Cameras & Drones': 'Câmeras e Drones',
    'Computers & Accessories': 'Computadores e Acessórios',
    'Fashion Accessories': 'Acessórios de Moda',
    'Food & Beverages': 'Alimentos e Bebidas',
    'Gaming & Consoles': 'Games e Consoles',
    'Health': 'Saúde',
    'Hobbies & Collections': 'Hobbies e Colecionáveis',
    'Home & Living': 'Casa e Decoração',
    'Home Appliances': 'Eletrodomésticos',
    'Men Bags': 'Bolsas Masculinas',
    'Men Clothes': 'Moda Masculina',
    'Men Shoes': 'Calçados Masculinos',
    'Mobile & Gadgets': 'Celulares e Acessórios',
    'Mom & Baby': 'Mamãe e Bebê',
    'Motorcycles': 'Motos',
    'Pets': 'Pets',
    'Spare Parts and Accessories for Vehicles': 'Peças e Acessórios para Veículos',
    'Sports & Outdoors': 'Esportes e Lazer',
    'Stationery': 'Papelaria',
    'Travel & Luggage': 'Viagem e Bagagem',
    'Watches': 'Relógios',
    'Women Bags': 'Bolsas Femininas',
    'Women Clothes': 'Moda Feminina',
    'Women Shoes': 'Calçados Femininos'
};

const SUBCATEGORY_MAP = {
    'Costumes': 'Fantasias',
    'Hoodies & Sweatshirts': 'Moletons',
    'Innerwear & Underwear': 'Cuecas e Roupa Íntima',
    'Jackets, Coats & Vests': 'Jaquetas, Casacos e Coletes',
    'Jeans': 'Jeans',
    'Occupational Attire': 'Uniformes Profissionais',
    'Others': 'Outros',
    'Pants': 'Calças',
    'Sets': 'Conjuntos',
    'Shorts': 'Bermudas e Shorts',
    'Sleepwear': 'Pijamas',
    'Socks': 'Meias',
    'Suits': 'Ternos',
    'Sweaters & Cardigans': 'Suéteres e Cardigãs',
    'Tops': 'Camisetas e Blusas',
    'Traditional Wear': 'Roupas Tradicionais'
};

function translateCategory(sourceName) {
    const original = String(sourceName || '').trim();

    return {
        sourceName: original,
        displayName: CATEGORY_MAP[original] || original,
        translationStatus:
            CATEGORY_MAP[original] ? 'translated' : 'pending'
    };
}

function translateSubcategory(sourceName) {
    const original = String(sourceName || '').trim();

    return {
        sourceName: original,
        displayName: SUBCATEGORY_MAP[original] || original,
        translationStatus:
            SUBCATEGORY_MAP[original] ? 'translated' : 'pending'
    };
}

module.exports = {
    CATEGORY_MAP,
    SUBCATEGORY_MAP,
    translateCategory,
    translateSubcategory
};