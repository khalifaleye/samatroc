/**
 * Seed SamaTroc — données de démonstration réalistes
 * Comptes de démonstration distincts (isDemo: true), annonces variées,
 * propositions, conversations, paiements de test, contenus éditoriaux.
 *
 * Exécution : bun prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readdirSync } from "fs";
import path from "path";

const db = new PrismaClient();

const IMG_DIR = path.join(process.cwd(), "public", "images", "listings");

/** Récupère les images disponibles par clé, ex: images("iphone") => [url, ...] */
function images(key: string, max = 3): { url: string; isPrimary: boolean }[] {
  try {
    if (!existsSync(IMG_DIR)) return [];
    const files = readdirSync(IMG_DIR)
      .filter((f) => f.startsWith(key + "-"))
      .sort()
      .slice(0, max)
      .map((f) => ({ url: `/images/listings/${f}`, isPrimary: false }));
    return files.map((f, i) => ({ ...f, isPrimary: i === 0 }));
  } catch {
    return [];
  }
}

const DAYS = 24 * 60 * 60 * 1000;

async function main() {
  console.log("🌱 Seed SamaTroc démarré...");

  // Nettoyage complet (ordre de dépendances)
  await db.adminLog.deleteMany();
  await db.report.deleteMany();
  await db.block.deleteMany();
  await db.notification.deleteMany();
  await db.message.deleteMany();
  await db.conversation.deleteMany();
  await db.exchangeProposal.deleteMany();
  await db.payment.deleteMany();
  await db.favorite.deleteMany();
  await db.listingImage.deleteMany();
  await db.listing.deleteMany();
  await db.verificationToken.deleteMany();
  await db.passwordResetToken.deleteMany();
  await db.profile.deleteMany();
  await db.user.deleteMany();
  await db.category.deleteMany();
  await db.city.deleteMany();
  await db.siteContent.deleteMany();
  await db.siteSetting.deleteMany();

  // ==========================================
  // PARAMÈTRES GÉNÉRAUX
  // ==========================================
  const settings: Record<string, string> = {
    platform_name: "SamaTroc",
    platform_email: "contact@samatroc.sn",
    platform_phone: "+221 77 000 00 00",
    publication_fee: "500",
    listing_validity_days: "60",
    auto_moderate: "false",
    announcement_banner: "",
    facebook_url: "https://facebook.com/samatroc",
    instagram_url: "https://instagram.com/samatroc",
    tiktok_url: "https://tiktok.com/@samatroc",
    youtube_url: "https://youtube.com/@samatroc",
    whatsapp_number: "+221 77 000 00 00",
    // Statistiques de démonstration (clairement identifiées côté interface)
    demo_stats_users: "1250",
    demo_stats_listings: "3480",
    demo_stats_exchanges: "2150",
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.siteSetting.create({ data: { key, value } });
  }
  console.log("✓ Paramètres généraux");

  // ==========================================
  // CATÉGORIES (issues de la maquette)
  // ==========================================
  const catsData = [
    { name: "Vêtements & chaussures", slug: "vetements-chaussures", icon: "shirt", color: "#12a05f" },
    { name: "Électronique & téléphonie", slug: "electronique-telephonie", icon: "smartphone", color: "#0e5c3d" },
    { name: "Maison & jardin", slug: "maison-jardin", icon: "home", color: "#2dbd80" },
    { name: "Beauté & santé", slug: "beaute-sante", icon: "flower", color: "#ec4899" },
    { name: "Sport & loisirs", slug: "sport-loisirs", icon: "trophy", color: "#f59e0b" },
    { name: "Livres & papeterie", slug: "livres-papeterie", icon: "book", color: "#0a3d2a" },
    { name: "Enfants & bébés", slug: "enfants-bebes", icon: "baby", color: "#8b5cf6" },
    { name: "Meubles & décoration", slug: "meubles-decoration", icon: "armchair", color: "#17724c" },
    { name: "Autres", slug: "autres", icon: "grid", color: "#5b6b63" },
  ];
  const cats: Record<string, string> = {};
  for (let i = 0; i < catsData.length; i++) {
    const c = await db.category.create({ data: { ...catsData[i], sortOrder: i } });
    cats[c.slug] = c.id;
  }
  // Sous-catégories de démonstration
  const subElec = await db.category.create({
    data: { name: "Téléphones", slug: "telephones", icon: "smartphone", color: "#0e5c3d", sortOrder: 0, parentId: cats["electronique-telephonie"] },
  });
  await db.category.create({
    data: { name: "Informatique", slug: "informatique", icon: "laptop", color: "#0e5c3d", sortOrder: 1, parentId: cats["electronique-telephonie"] },
  });
  await db.category.create({
    data: { name: "Jeux vidéo", slug: "jeux-video", icon: "gamepad", color: "#0e5c3d", sortOrder: 2, parentId: cats["electronique-telephonie"] },
  });
  console.log("✓ Catégories");

  // ==========================================
  // VILLES DU SÉNÉGAL
  // ==========================================
  const cities = [
    ["Dakar", "Dakar"], ["Thiès", "Thiès"], ["Mbour", "Thiès"], ["Touba", "Diourbel"],
    ["Saint-Louis", "Saint-Louis"], ["Kaolack", "Kaolack"], ["Ziguinchor", "Ziguinchor"],
    ["Diourbel", "Diourbel"], ["Louga", "Louga"], ["Fatick", "Fatick"],
    ["Tambacounda", "Tambacounda"], ["Kolda", "Kolda"], ["Matam", "Matam"],
    ["Kédougou", "Kédougou"], ["Sédhiou", "Sédhiou"],
  ];
  for (const [name, region] of cities) {
    await db.city.create({ data: { name, region } });
  }
  console.log("✓ Villes");

  // ==========================================
  // UTILISATEURS (démo)
  // ==========================================
  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const adminHash = await bcrypt.hash("admin1234", 10);

  const usersData = [
    { firstName: "Aminata", lastName: "Diallo", email: "admin@samatroc.sn", phone: "+221771234501", city: "Dakar", role: "SUPER_ADMIN", passwordHash: adminHash, isDemo: false, bio: "Administratrice de la plateforme SamaTroc." },
    { firstName: "Moussa", lastName: "Ndiaye", email: "moussa@demo.sn", phone: "+221771234502", city: "Dakar", role: "USER", passwordHash, isDemo: true, bio: "Passionné de tech, j'aime donner une seconde vie aux objets." },
    { firstName: "Fatou", lastName: "Sall", email: "fatou@demo.sn", phone: "+221781234503", city: "Thiès", role: "USER", passwordHash, isDemo: true, bio: "Maman de trois enfants, adepte du troc familial." },
    { firstName: "Ousmane", lastName: "Diop", email: "ousmane@demo.sn", phone: "+221761234504", city: "Mbour", role: "USER", passwordHash, isDemo: true, bio: "Étudiant à Thiès, je troque mes livres chaque année." },
    { firstName: "Awa", lastName: "Ba", email: "awa@demo.sn", phone: "+221775556605", city: "Saint-Louis", role: "USER", passwordHash, isDemo: true, bio: "Amoureuse de la déco et du réemploi." },
    { firstName: "Cheikh", lastName: "Fall", email: "cheikh@demo.sn", phone: "+221775556606", city: "Kaolack", role: "USER", passwordHash, isDemo: true, bio: "Sportif et vidéaste amateur." },
    { firstName: "Mariama", lastName: "Sène", email: "mariama@demo.sn", phone: "+221775556607", city: "Ziguinchor", role: "USER", passwordHash, isDemo: true, bio: "Je couds, je transforme, j'échange." },
    { firstName: "Ibrahima", lastName: "Gaye", email: "ibrahima@demo.sn", phone: "+221775556608", city: "Touba", role: "USER", passwordHash, isDemo: true, bio: "Père de famille, ventilateur de bonnes affaires." },
  ];

  const users: Record<string, string> = {};
  for (const u of usersData) {
    const created = await db.user.create({
      data: {
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        passwordHash: u.passwordHash,
        phone: u.phone,
        city: u.city,
        role: u.role,
        isDemo: u.isDemo,
        emailVerified: true,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 90 + 20) * DAYS),
        profile: { create: { bio: u.bio, showPhone: false, whatsappEnabled: true } },
      },
    });
    users[u.firstName] = created.id;
  }
  console.log("✓ Utilisateurs (8, dont admin@samatroc.sn / admin1234)");

  // ==========================================
  // ANNONCES (22+, variées et réalistes)
  // ==========================================
  type L = {
    key: string; owner: string; title: string; description: string; cat: string; sub?: string;
    condition: string; city: string; quartier?: string; wanted: string; wantedCat?: string;
    status?: string; featured?: boolean; days: number; views?: number;
  };

  const listingsData: L[] = [
    { key: "iphone", owner: "Moussa", title: "iPhone 11 en bon état", description: "iPhone 11 64 Go noir, très bien entretenu, toujours protégé avec coque et verre trempé depuis l'achat. Batterie à 89%. Livré avec câble de charge. Aucune rayure notable, écran impeccable. Je le cède contre un ordinateur portable fonctionnel pour mes études.", cat: "electronique-telephonie", sub: subElec.id, condition: "BON", city: "Dakar", quartier: "Sacré-Cœur", wanted: "ordinateur portable", wantedCat: "Électronique & téléphonie", days: 2, views: 87, featured: true },
    { key: "clothes", owner: "Fatou", title: "Vêtements femme (lot de 12 pièces)", description: "Lot de vêtements femme taille 38-40 : jeans, robes, hauts et foulards. Tous lavés et repassés, certains jamais portés. Marques variées (Zara, H&M, enseignes locales). Idéal pour renouveler sa garde-robe sans se ruiner. Je cherche un sac à main de qualité en échange.", cat: "vetements-chaussures", condition: "TRES_BON", city: "Dakar", quartier: "Ouakam", wanted: "sac à main", wantedCat: "Vêtements & chaussures", days: 3, views: 64 },
    { key: "bike", owner: "Cheikh", title: "Vélo VTT 26 pouces", description: "VTT 26 pouces 21 vitesses, freins v-brake révisés récemment, pneus neufs. Parfait pour les trajets quotidiens ou les balades dominicales. Petite rayure sur le cadre, sans impact sur le fonctionnement. Je recherche un casque et des accessoires de vélo.", cat: "sport-loisirs", condition: "BON", city: "Dakar", quartier: "Yoff", wanted: "casque et accessoires sport", wantedCat: "Sport & loisirs", days: 5, views: 132 },
    { key: "sofa", owner: "Awa", title: "Canapé 2 places en tissu gris", description: "Canapé 2 places très confortable, structure en bois massif, tissu gris anthracite sans tache. À venir chercher sur place (3e étage avec ascenseur). Je déménage et souhaite une table basse assortie pour mon nouveau salon.", cat: "meubles-decoration", condition: "TRES_BON", city: "Dakar", quartier: "Mermoz", wanted: "table basse", wantedCat: "Meubles & décoration", days: 1, views: 45, featured: true },
    { key: "sandals", owner: "Mariama", title: "Sandales femme cuir (taille 39)", description: "Paire de sandales en cuir véritable, portées deux fois seulement, semelle impeccable. Confortables pour la saison chaude. Je cherche un parfum ou un produit cosmétique en échange.", cat: "vetements-chaussures", condition: "TRES_BON", city: "Dakar", quartier: "Plateau", wanted: "parfum", wantedCat: "Beauté & santé", days: 6, views: 38 },
    { key: "ps4", owner: "Ibrahima", title: "Manette PS4 DualShock 4", description: "Manette DualShock 4 blanche, testée et fonctionnelle, joystick gauche légèrement usé (typique). Idéale pour remplacer une manette défectueuse. Je recherche un jeu PS4 ou des accessoires gaming.", cat: "electronique-telephonie", sub: subElec.id, condition: "SATISFAISANT", city: "Dakar", quartier: "Guédiawaye", wanted: "jeux PS4", wantedCat: "Électronique & téléphonie", days: 4, views: 91 },
    { key: "table", owner: "Awa", title: "Table à manger bois 6 places", description: "Table à manger en bois massif avec 4 chaises incluses. Solide et stable, quelques marques d'usage sur le plateau. Dimensions 160 x 90 cm. À récupérer sur place. Je cherche un canapé 2 places pour le salon.", cat: "meubles-decoration", condition: "BON", city: "Dakar", quartier: "Ngor", wanted: "canapé 2 places", wantedCat: "Meubles & décoration", days: 8, views: 56 },
    { key: "kidsclothes", owner: "Fatou", title: "Lot de vêtements enfants 2-4 ans", description: "Lot de 15 pièces pour garçon et fille de 2 à 4 ans : body, t-shirts, pantalons, pyjamas. En très bon état, lavés à 30°, sans tache. Certains articles neufs avec étiquette. Je cherche des jouets éducatifs pour mes jumeaux.", cat: "enfants-bebes", condition: "TRES_BON", city: "Thiès", quartier: "Randoulène", wanted: "jouets éducatifs", wantedCat: "Enfants & bébés", days: 2, views: 73 },
    { key: "books", owner: "Ousmane", title: "Lot de manuels de droit (L2-L3)", description: "Manuels de droit des obligations, droit constitutionnel et droit du travail, éditions 2022-2023. Annotations au crayon papier, très lisible. Parfait pour les étudiants en licence. Je cherche un sac à dos solide pour l'université.", cat: "livres-papeterie", condition: "BON", city: "Thiès", wanted: "sac à dos", wantedCat: "Livres & papeterie", days: 9, views: 29 },
    { key: "perfume", owner: "Awa", title: "Coffret parfum femme (à échanger)", description: "Coffret parfum reçu en cadeau, jamais ouvert, toujours sous cellophane. Eau de parfum 50 ml + lait corps. Je le propose contre des sandales ou accessoires femme.", cat: "beaute-sante", condition: "NEUF", city: "Saint-Louis", wanted: "sandales femme", wantedCat: "Vêtements & chaussures", days: 3, views: 42 },
    { key: "football", owner: "Cheikh", title: "Ballon de football taille 5", description: "Ballon taille 5 officiel, très peu utilisé, toujours gonflé correctement. Parfait pour les entraînements du week-end. Je cherche des chaussures de foot taille 43.", cat: "sport-loisirs", condition: "TRES_BON", city: "Kaolack", wanted: "chaussures de football", wantedCat: "Sport & loisirs", days: 7, views: 24 },
    { key: "laptop", owner: "Moussa", title: "Ordinateur portable 15 pouces (à réparer)", description: "Ordinateur portable 15 pouces i5, 8 Go RAM. Le disque dur a rendu l'âme, le reste fonctionne (écran, clavier, batterie). Idéal pour pièces ou pour bricoleur équipé. Je cherche un vélo pour mes trajets.", cat: "electronique-telephonie", condition: "SATISFAISANT", city: "Dakar", quartier: "Fann", wanted: "vélo adulte", wantedCat: "Sport & loisirs", days: 10, views: 158 },
    { key: "tv", owner: "Ibrahima", title: "Téléviseur LED 40 pouces", description: "Téléviseur LED 40 pouces Full HD, image et son parfaits, télécommande incluse. Vendu avec son support mural. Déménagement urgent, je cherche un micro-ondes en bon état.", cat: "electronique-telephonie", condition: "BON", city: "Touba", wanted: "micro-ondes", wantedCat: "Maison & jardin", days: 5, views: 67 },
    { key: "guitar", owner: "Ousmane", title: "Guitare acoustique débutant", description: "Guitare acoustique pour débutant, cordes neuves changées le mois dernier, son clair et équilibré. Accordeur offert. Je souhaite la troquer contre un clavier musical d'occasion.", cat: "sport-loisirs", condition: "BON", city: "Mbour", wanted: "clavier musical", wantedCat: "Sport & loisirs", days: 12, views: 35 },
    { key: "handbag", owner: "Mariama", title: "Sac à main cuir camel", description: "Sac à main en cuir camel, grande capacité (format A4), bandoulière amovible. Fermeture zippée fonctionnelle, intérieur propre. Je cherche une paire de baskets taille 39.", cat: "vetements-chaussures", condition: "TRES_BON", city: "Ziguinchor", wanted: "baskets", wantedCat: "Vêtements & chaussures", days: 6, views: 51 },
    { key: "stroller", owner: "Fatou", title: "Poussette bébé 3 roues", description: "Poussette tout-terrain 3 roues, pliable une main, panier de rangement, capote anti-UV. Roues et freins impeccables, lavée et désinfectée. Je cherche un siège auto groupe 1.", cat: "enfants-bebes", condition: "BON", city: "Thiès", wanted: "siège auto", wantedCat: "Enfants & bébés", days: 4, views: 44 },
    { key: "clothes", owner: "Fatou", title: "Boubous traditionnels homme (2 pièces)", description: "Deux boubous brodés taille L, portés pour des cérémonies, très bien conservés. Tissu bazin riche qualité supérieure. Je cherche des jouets pour enfants en échange.", cat: "vetements-chaussures", condition: "TRES_BON", city: "Dakar", quartier: "Médina", wanted: "jouets enfants", wantedCat: "Enfants & bébés", days: 15, views: 30 },
    { key: "books", owner: "Ousmane", title: "Romans français (lot de 8)", description: "Huit romans de littérature française contemporaine en poche, quelques couvertures pliées mais pages intactes. À échanger contre des livres de développement personnel.", cat: "livres-papeterie", condition: "SATISFAISANT", city: "Mbour", wanted: "livres développement personnel", wantedCat: "Livres & papeterie", days: 18, views: 22 },
    { key: "maillot", owner: "Cheikh", title: "Maillot de football officiel (neuf)", description: "Maillot officiel taille M, jamais porté, étiquette intacte. Collection saison passée. Je cherche un ballon de football ou des gants de gardien.", cat: "sport-loisirs", condition: "NEUF", city: "Kaolack", wanted: "ballon de football", wantedCat: "Sport & loisirs", days: 20, views: 18 },
    { key: "sofa", owner: "Awa", title: "Fauteuil de salon en rotin", description: "Fauteuil en rotin artisanal fait main à Ziguinchor, assise rembourrée confortable. Très bon état, léger dépoussiérage à prévoir. Je cherche des coussins décoratifs.", cat: "meubles-decoration", condition: "BON", city: "Saint-Louis", wanted: "coussins décoratifs", wantedCat: "Meubles & décoration", days: 22, views: 27 },
    { key: "iphone", owner: "Moussa", title: "Écouteurs sans fil Bluetooth", description: "Écouteurs Bluetooth autonomie 6 heures, boîtier de charge inclus, son puissant et basses présentes. Fonctionnent parfaitement avec iPhone et Android. Je cherche une coque de téléphone.", cat: "electronique-telephonie", condition: "BON", city: "Dakar", quartier: "Parcelles Assainies", wanted: "coque téléphone", wantedCat: "Électronique & téléphonie", days: 11, views: 39 },
    { key: "kidsclothes", owner: "Fatou", title: "Jouets éducatifs en bois (lot)", description: "Lot de jouets en bois : puzzle, cubes, empilables. Éducatifs et robustes, aucun élément manquant, nettoyés. Parfait pour les 2-5 ans. Je cherche des livres pour enfants.", cat: "enfants-bebes", condition: "TRES_BON", city: "Thiès", wanted: "livres pour enfants", wantedCat: "Livres & papeterie", days: 14, views: 33 },
    { key: "table", owner: "Ibrahima", title: "Bureau d'étudiant avec rangements", description: "Bureau d'étudiant avec 3 tiroirs et niche pour ordinateur. Structure solide, quelques marques de stylo sur le plateau (effaçables). Je cherche une chaise de bureau ergonomique.", cat: "meubles-decoration", condition: "SATISFAISANT", city: "Touba", wanted: "chaise de bureau", wantedCat: "Meubles & décoration", days: 16, views: 41 },
    { key: "laptopbag", owner: "Awa", title: "Sac d'ordinateur renforcé", description: "Sac à dos renforcé pour ordinateur 15 pouces, compartiment rembourré, port USB externe, tissu déperlant. Acheté 15 000 FCFA, presque neuf. Je cherche des écouteurs sans fil.", cat: "livres-papeterie", condition: "TRES_BON", city: "Saint-Louis", wanted: "écouteurs sans fil", wantedCat: "Électronique & téléphonie", days: 8, views: 48 },
    // ----- Nouvelles annonces -----
    { key: "samsung", owner: "Moussa", title: "Samsung Galaxy A14 128 Go", description: "Samsung Galaxy A14, 128 Go, écran 6,6 pouces impeccable, batterie excellente, toujours protégé avec coque et verre trempé depuis l'achat. Chargeur d'origine inclus. Je cherche un casque bluetooth pour le sport.", cat: "electronique-telephonie", sub: subElec.id, condition: "TRES_BON", city: "Dakar", quartier: "Parcelles Assainies", wanted: "casque bluetooth", wantedCat: "Électronique & téléphonie", days: 3, views: 58, featured: true },
    { key: "wax", owner: "Fatou", title: "Lot de pagnes wax (6 pièces)", description: "Six pagnes en wax authentique, couleurs vives, jamais coupés ni lavés, motifs variés. Parfaits pour confectionner robes, boubous ou accessoires. Je cherche une machine à coudre en bon état pour mes projets couture.", cat: "vetements-chaussures", condition: "NEUF", city: "Thiès", quartier: "Randoulène", wanted: "machine à coudre", wantedCat: "Maison & jardin", days: 4, views: 47 },
    { key: "microwave", owner: "Cheikh", title: "Micro-ondes 20L en très bon état", description: "Micro-ondes 20 litres, 700 W, verre et intérieur impeccables, toutes les fonctions testées (réchauffage, décongélation). Plateau tournant d'origine. Je déménage pour Dakar et cherche un casque gaming en échange.", cat: "maison-jardin", condition: "TRES_BON", city: "Kaolack", wanted: "casque gaming", wantedCat: "Électronique & téléphonie", days: 3, views: 19 },
    { key: "sneakers", owner: "Moussa", title: "Baskets homme taille 43 (quasi neuves)", description: "Baskets homme taille 43, portées trois fois, semelles comme neuves, modèle blanc et bleu très polyvalent. Achetées 18 000 FCFA il y a deux mois. Je reprends mes études de droit, je cherche des manuels de licence en échange.", cat: "vetements-chaussures", condition: "TRES_BON", city: "Dakar", quartier: "Sacré-Cœur", wanted: "manuels de droit", wantedCat: "Livres & papeterie", days: 2, views: 35 },
    { key: "schoolbag", owner: "Ousmane", title: "Sac à dos scolaire renforcé", description: "Sac à dos renforcé pour l'université : compartiment ordinateur 15 pouces, coutures solides, plusieurs poches de rangement. Utilisé un semestre, très propre. Je cherche une calculatrice scientifique en bon état.", cat: "livres-papeterie", condition: "BON", city: "Thiès", wanted: "calculatrice scientifique", wantedCat: "Livres & papeterie", days: 5, views: 16 },
    { key: "carseat", owner: "Mariama", title: "Siège auto bébé groupe 1 (9-18 kg)", description: "Siège auto groupe 1 homologué, protections latérales, harnais 5 points, housse déhoussable et lavable. Jamais accidenté, stocké à l'abri. Ma fille vient de passer au siège suivant. Je cherche une poussette légère pour les voyages.", cat: "enfants-bebes", condition: "TRES_BON", city: "Ziguinchor", wanted: "poussette bébé", wantedCat: "Enfants & bébés", days: 5, views: 21 },
    { key: "fridge", owner: "Ibrahima", title: "Réfrigérateur combiné 250L", description: "Réfrigérateur combiné 250 litres avec freezer, froid ventilé, étagères en verre. Fonctionne parfaitement, à venir tester sur place. Je cherche une machine à laver fonctionnelle en échange.", cat: "maison-jardin", condition: "BON", city: "Touba", wanted: "machine à laver", wantedCat: "Maison & jardin", days: 7, views: 64 },
    { key: "sewingmachine", owner: "Mariama", title: "Machine à coudre robuste (occasion)", description: "Machine à coudre mécanique très robuste, révisée, pique droit et zigzag parfaitement. Idéale pour retouches et confection de boubous. Livrée avec bobines et aiguilles de rechange. Je cherche du bazin pour mes créations.", cat: "maison-jardin", condition: "BON", city: "Ziguinchor", quartier: "Escale", wanted: "tissus bazin", wantedCat: "Vêtements & chaussures", days: 9, views: 28 },
    { key: "djembe", owner: "Ousmane", title: "Djembé artisanal sculpté main", description: "Djembé en bois de lenke sculpté à la main, peau de chèvre tendue, son profond et puissant. Hauteur 60 cm, diamètre 32 cm. Acheté à un artisan de Casamance. Je souhaite le troquer contre une guitare acoustique.", cat: "sport-loisirs", condition: "TRES_BON", city: "Mbour", wanted: "guitare acoustique", wantedCat: "Sport & loisirs", days: 6, views: 33 },
    { key: "bed", owner: "Awa", title: "Lit en bois massif + matelas 140x190", description: "Lit double en bois massif 140x190 avec sommier et matelas ferme en très bon état, protégé par housse depuis l'achat. Déménagement, à récupérer sur place. Je cherche une table de chevet assortie.", cat: "meubles-decoration", condition: "BON", city: "Dakar", quartier: "Mermoz", wanted: "table de chevet", wantedCat: "Meubles & décoration", days: 8, views: 39 },
  ];

  const listings: Record<string, string> = {};
  for (const l of listingsData) {
    const imgs = images(l.key);
    const created = await db.listing.create({
      data: {
        reference: `ST-ANN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        userId: users[l.owner],
        title: l.title,
        description: l.description,
        categoryId: cats[l.cat],
        subcategoryId: l.sub ?? null,
        condition: l.condition,
        city: l.city,
        quartier: l.quartier ?? null,
        wantedText: l.wanted,
        wantedCategory: l.wantedCat ?? null,
        wantedMultiple: Math.random() > 0.6,
        status: l.status ?? "PUBLISHED",
        featured: l.featured ?? false,
        viewsCount: l.views ?? Math.floor(Math.random() * 60 + 5),
        publishedAt: new Date(Date.now() - l.days * DAYS),
        createdAt: new Date(Date.now() - (l.days + 1) * DAYS),
        expiresAt: new Date(Date.now() + (60 - l.days) * DAYS),
        images: {
          create: imgs.map((img, i) => ({
            url: img.url,
            isPrimary: i === 0,
            sortOrder: i,
          })),
        },
      },
    });
    listings[l.title] = created.id;
  }
  console.log(`✓ Annonces (${listingsData.length})`);

  // ==========================================
  // PAIEMENTS DE TEST (identifiés)
  // ==========================================
  const paidListings = await db.listing.findMany({ where: { status: "PUBLISHED" }, take: 12 });
  for (const l of paidListings) {
    await db.payment.create({
      data: {
        reference: `ST-PAY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        userId: l.userId,
        listingId: l.id,
        amount: 500,
        provider: Math.random() > 0.5 ? "WAVE" : "ORANGE_MONEY",
        method: Math.random() > 0.5 ? "Wave" : "Orange Money",
        status: "SUCCESS",
        isTest: true,
        phone: "+221771234599",
        paidAt: new Date(l.createdAt.getTime() + 30 * 60 * 1000),
        createdAt: l.createdAt,
      },
    });
  }
  console.log("✓ Paiements de test (transactions clairement identifiées)");

  // ==========================================
  // PROPOSITIONS D'ÉCHANGE
  // ==========================================
  const prop1 = await db.exchangeProposal.create({
    data: {
      listingId: listings["iPhone 11 en bon état"],
      proposerId: users["Ousmane"],
      offeredText: "Ordinateur portable Dell 14 pouces Core i3, 4 Go RAM, SSD 256 Go, très bon état",
      message: "Bonjour ! Je vous propose mon ordinateur portable Dell en parfait état pour votre iPhone. Intéressé ?",
      status: "PENDING",
    },
  });
  const prop2 = await db.exchangeProposal.create({
    data: {
      listingId: listings["Canapé 2 places en tissu gris"],
      proposerId: users["Ibrahima"],
      offeredListingId: listings["Table à manger bois 6 places"],
      message: "Bonjour Awa, ma table à manger (avec 4 chaises) contre votre canapé. On peut se rejoindre à mi-chemin.",
      status: "ACCEPTED",
      respondedAt: new Date(Date.now() - 1 * DAYS),
    },
  });
  const prop3 = await db.exchangeProposal.create({
    data: {
      listingId: listings["Manette PS4 DualShock 4"],
      proposerId: users["Cheikh"],
      offeredText: "Ballon de football taille 5 + gants de gardien",
      message: "Échange ballon + gants contre la manette, possible week-end à Kaolack gare.",
      status: "DISCUSSING",
      counterText: "D'accord si vous ajoutez un maillot à votre offre.",
      respondedAt: new Date(Date.now() - 2 * DAYS),
    },
  });
  const prop4 = await db.exchangeProposal.create({
    data: {
      listingId: listings["Lot de vêtements enfants 2-4 ans"],
      proposerId: users["Mariama"],
      offeredListingId: listings["Sac à main cuir camel"],
      message: "Mon sac cuir camel contre votre lot de vêtements pour ma nièce ?",
      status: "REFUSED",
      respondedAt: new Date(Date.now() - 3 * DAYS),
    },
  });
  const prop5 = await db.exchangeProposal.create({
    data: {
      listingId: listings["Poussette bébé 3 roues"],
      proposerId: users["Awa"],
      offeredText: "Coffret parfum femme neuf sous cellophane",
      message: "Pour ma petite sœur qui attend un bébé. Coffret neuf jamais ouvert !",
      status: "COMPLETED",
      respondedAt: new Date(Date.now() - 6 * DAYS),
      completedAt: new Date(Date.now() - 2 * DAYS),
    },
  });

  // Marque la poussette échangée
  await db.listing.update({
    where: { id: listings["Poussette bébé 3 roues"] },
    data: { status: "EXCHANGED" },
  });
  const prop6 = await db.exchangeProposal.create({
    data: {
      listingId: listings["Samsung Galaxy A14 128 Go"],
      proposerId: users["Cheikh"],
      offeredListingId: listings["Micro-ondes 20L en très bon état"],
      message: "Bonjour ! Mon micro-ondes (je déménage, je n'en aurai plus l'usage) contre votre Galaxy A14. Test possible à Kaolack.",
      status: "PENDING",
    },
  });
  const prop7 = await db.exchangeProposal.create({
    data: {
      listingId: listings["Lit en bois massif + matelas 140x190"],
      proposerId: users["Ibrahima"],
      offeredText: "Table de chevet en bois massif + lampe de bureau assortie",
      message: "Bonjour Awa, j'ai une table de chevet en bois et une lampe assorties à votre lit. Échange possible ce week-end.",
      status: "DISCUSSING",
      counterText: "Merci pour votre offre ! Auriez-vous une photo de la table de chevet ?",
      respondedAt: new Date(Date.now() - 2 * DAYS),
    },
  });
  console.log(`✓ Propositions d'échange (7)`);

  // ==========================================
  // CONVERSATIONS & MESSAGES
  // ==========================================
  async function makeConversation(
    a: string, b: string, listingTitle: string | null,
    msgs: { from: string; content: string; hoursAgo: number; system?: boolean }[],
    readByA = true
  ) {
    const [userAId, userBId] = [users[a], users[b]].sort();
    const listingId = listingTitle ? listings[listingTitle] : null;
    const conv = await db.conversation.create({
      data: { userAId, userBId, listingId, createdAt: new Date(Date.now() - (msgs[0]?.hoursAgo ?? 1) * 60 * 60 * 1000) },
    });
    for (const m of msgs) {
      await db.message.create({
        data: {
          conversationId: conv.id,
          senderId: m.system ? null : users[m.from],
          type: m.system ? "SYSTEM" : "TEXT",
          content: m.content,
          readAt: readByA ? new Date() : null,
          createdAt: new Date(Date.now() - m.hoursAgo * 60 * 60 * 1000),
        },
      });
    }
    const last = msgs[msgs.length - 1];
    await db.conversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: new Date(Date.now() - (last?.hoursAgo ?? 1) * 60 * 60 * 1000) },
    });
    return conv.id;
  }

  await makeConversation("Ousmane", "Moussa", "iPhone 11 en bon état", [
    { from: "Ousmane", content: "Bonjour Moussa ! J'ai vu votre iPhone 11. Je vous propose mon ordinateur portable Dell en échange.", hoursAgo: 20 },
    { from: "Moussa", content: "Bonjour Ousmane, merci pour votre proposition. Quel est le modèle exact et la batterie ?", hoursAgo: 18 },
    { from: "Ousmane", content: "Dell Inspiron 14, batterie à 92%, acheté en 2022. Je peux vous montrer des photos.", hoursAgo: 5 },
  ], false);

  await makeConversation("Awa", "Ibrahima", "Canapé 2 places en tissu gris", [
    { from: "Ibrahima", content: "Bonjour, votre canapé m'intéresse. J'ai une table à manger 6 places à proposer.", hoursAgo: 30 },
    { from: "Awa", content: "Bonjour ! C'est noté, la table m'intéresse beaucoup. Quand pourrait-on convenir d'un échange ?", hoursAgo: 28 },
    { from: "Ibrahima", content: "Samedi matin à Ouakam, si cela vous convient ?", hoursAgo: 26 },
    { from: "Awa", content: "Parfait pour samedi 10h devant la pharmacie Ouakam marché. À samedi !", hoursAgo: 25 },
  ]);

  await makeConversation("Cheikh", "Ibrahima", "Manette PS4 DualShock 4", [
    { from: "Cheikh", content: "Salut ! Ballon + gants contre ta manette ?", hoursAgo: 50, },
    { from: "Ibrahima", content: "Salut Cheikh. Possible si tu ajoutes un maillot.", hoursAgo: 48 },
  ], false);

  await makeConversation("Fatou", "Awa", "Coffret parfum femme (à échanger)", [
    { from: "Awa", content: "Bonjour Fatou, le coffret est encore disponible contre votre poussette ?", hoursAgo: 100 },
    { from: "Fatou", content: "Bonjour ! Oui, on peut se rencontrer à Thiès ce week-end.", hoursAgo: 98 },
    { from: "Awa", content: "C'est fait, l'échange s'est très bien passé. Merci !", hoursAgo: 48 },
    { from: "Fatou", content: "Merci à vous, super échange. Je recommande Awa à toute la communauté !", hoursAgo: 47 },
  ]);
  console.log("✓ Conversations et messages");

  // ==========================================
  // FAVORIS
  // ==========================================
  const favPairs: [string, string][] = [
    ["Ousmane", "iPhone 11 en bon état"],
    ["Ousmane", "Vélo VTT 26 pouces"],
    ["Awa", "Table à manger bois 6 places"],
    ["Cheikh", "Téléviseur LED 40 pouces"],
    ["Moussa", "Lot de vêtements enfants 2-4 ans"],
    ["Cheikh", "Samsung Galaxy A14 128 Go"],
    ["Fatou", "Djembé artisanal sculpté main"],
    ["Mariama", "Lot de pagnes wax (6 pièces)"],
  ];
  for (const [u, t] of favPairs) {
    await db.favorite.create({
      data: { userId: users[u], listingId: listings[t] },
    }).catch(() => undefined);
  }
  console.log("✓ Favoris");

  // ==========================================
  // NOTIFICATIONS (démo pour l'admin et les utilisateurs)
  // ==========================================
  const notifs: [string, string, string, string][] = [
    ["Moussa", "PROPOSAL_RECEIVED", "Nouvelle proposition d'échange", "Ousmane propose un échange pour « iPhone 11 en bon état »."],
    ["Ousmane", "MESSAGE", "Nouveau message", "Moussa vous a envoyé un message sur SamaTroc."],
    ["Awa", "PROPOSAL_ACCEPTED", "Proposition acceptée", "Ibrahima a accepté votre échange concernant « Table à manger bois 6 places »."],
    ["Fatou", "PROPOSAL_COMPLETED", "Échange réalisé", "L'échange avec Awa est marqué comme réalisé. Merci !"],
    ["Ibrahima", "PAYMENT_CONFIRMED", "Paiement confirmé", "Votre paiement de 500 FCFA a été confirmé. Votre annonce est en ligne."],
    ["Aminata", "SYSTEM", "Bienvenue sur SamaTroc", "Le back-office est prêt. Consultez le tableau de bord pour les statistiques."],
  ];
  for (const [u, type, title, body] of notifs) {
    await db.notification.create({
      data: { userId: users[u], type, title, body, readAt: Math.random() > 0.5 ? new Date() : null },
    });
  }
  console.log("✓ Notifications");

  // ==========================================
  // SIGNALEMENTS DE DÉMONSTRATION
  // ==========================================
  const suspiciousListing = listingsData[11]; // ordinateur portable "à réparer"
  await db.report.create({
    data: {
      reporterId: users["Fatou"],
      targetType: "LISTING",
      targetId: listings["Ordinateur portable 15 pouces (à réparer)"],
      reason: "AUTRE",
      details: "Le prix semble anormalement bas pour ce type d'appareil, à vérifier.",
      status: "PENDING",
    },
  });
  await db.report.create({
    data: {
      reporterId: users["Mariama"],
      targetType: "LISTING",
      targetId: listings[suspiciousListing.title],
      reason: "FRAUDE",
      details: "Demande d'envoi de code de confirmation par SMS : pratique suspecte.",
      status: "PENDING",
    },
  });
  await db.report.create({
    data: {
      reporterId: users["Ousmane"],
      targetType: "USER",
      targetId: users["Ibrahima"],
      reason: "AUTRE",
      details: "Retard de rendez-vous sans prévenir, à titre informatif.",
      status: "RESOLVED",
      resolution: "Rappel des règles de courtoisie envoyé à l'utilisateur.",
      handledById: users["Aminata"],
    },
  });
  console.log("✓ Signalements (3)");

  // ==========================================
  // CONTENUS ÉDITORIAUX
  // ==========================================
  const contents = [
    {
      page: "ABOUT",
      title: "À propos de SamaTroc",
      body: `## Notre mission\n\nSamaTroc est la plateforme sénégalaise qui permet aux particuliers d'échanger des objets dont ils n'ont plus besoin contre ceux dont ils ont besoin. Notre conviction : chaque objet a plusieurs vies.\n\n## Notre vision\n\nNous croyons à une consommation plus responsable, plus solidaire et plus économique. En facilitant les échanges de proximité, SamaTroc prolonge la durée de vie des objets et réduit le gaspillage.\n\n## Ce que nous faisons\n\n- Nous regroupons les annonces d'échange dans un espace simple et sûr\n- Nous mettons en relation les particuliers du Sénégal\n- Nous offrons une messagerie interne pour organiser les échanges\n\n## Ce que nous ne faisons pas\n\nSamaTroc est un service de mise en relation. Nous ne rachetons pas les objets, ne fixons pas leur valeur, ne gérons pas la livraison et ne participons pas aux échanges physiques. Les utilisateurs organisent librement leurs rencontres et leurs échanges.\n\n## Le financement\n\nLa consultation des annonces est gratuite. La publication d'une annonce est payante (à partir de 500 FCFA), ce qui garantit la qualité des annonces et le sérieux des utilisateurs. Ce financement couvre le fonctionnement de la plateforme.`,
    },
    {
      page: "HOW_IT_WORKS",
      title: "Comment ça marche ?",
      body: `## 1. Publiez votre annonce\n\nCréez votre compte, prenez quelques photos de votre objet, décrivez-le précisément et indiquez son état. La publication coûte à partir de 500 FCFA par article — c'est ce qui garantit des annonces sérieuses.\n\n## 2. Indiquez ce que vous cherchez\n\nPrécisez l'objet que vous souhaitez recevoir en échange. C'est la force de SamaTroc : chacun sait immédiatement ce qui peut vous intéresser.\n\n## 3. Recevez et faites des propositions\n\nParcourez les annonces et proposez un échange avec l'une de vos annonces ou décrivez l'objet que vous offrez. Le propriétaire accepte, refuse, demande des précisions ou fait une contre-proposition.\n\n## 4. Échangez en toute confiance\n\nUne fois l'accord trouvé, discutez via notre messagerie interne (ou WhatsApp si vous le souhaitez) et organisez la remise des objets. Rencontrez-vous dans des lieux publics et vérifiez les objets avant l'échange.\n\n## Bon à savoir\n\n- La consultation des annonces est gratuite\n- Le troc est un échange direct entre particuliers : aucun paiement de la valeur des objets ne transite par SamaTroc\n- Vous pouvez marquer une annonce comme « échangée » une fois l'échange réalisé`,
    },
    {
      page: "FAQ",
      title: "Questions fréquentes",
      body: `## La consultation des annonces est-elle payante ?\n\nNon, la consultation des annonces est entièrement gratuite. Seule la publication d'une annonce est payante, à partir de 500 FCFA par article.\n\n## Pourquoi la publication est-elle payante ?\n\nLes frais de publication couvrent le fonctionnement de la plateforme et garantissent des annonces sérieuses : les utilisateurs réfléchissent avant de publier, ce qui réduit fortement les annonces fantaisistes et le spam.\n\n## SamaTroc achète-t-il les objets ?\n\nNon. SamaTroc est un service de mise en relation. Nous ne rachetons pas les objets, ne fixons pas leur valeur et ne prenons aucune commission sur les échanges.\n\n## Comment se passe un échange ?\n\nLes deux utilisateurs conviennent librement du lieu, de la date et des modalités de la remise. Nous recommandons les lieux publics et l'inspection des objets avant l'échange.\n\n## Quels objets sont interdits ?\n\nSont interdits les biens illégaux, dangereux, volés ou contrefaits, les produits soumis à restrictions non respectées, ainsi que toute catégorie jugée incompatible avec la sécurité ou la loi. Consultez nos conditions d'utilisation.\n\n## Puis-je annuler ma publication et être remboursé ?\n\nConformément à nos conditions, un remboursement peut être accordé en cas d'échec technique de la plateforme. Contactez l'assistance avec votre référence de transaction.\n\n## Comment signaler une annonce suspecte ?\n\nUtilisez le bouton « Signaler » présent sur chaque annonce et chaque profil. Notre équipe de modération examine chaque signalement.\n\n## Mes données personnelles sont-elles protégées ?\n\nOui. Votre numéro de téléphone n'est jamais visible sans votre accord, et la messagerie interne permet d'échanger sans partager vos coordonnées. Consultez notre politique de confidentialité.`,
    },
    {
      page: "SAFETY",
      title: "Conseils pour échanger en toute sécurité",
      body: `## Rencontrez-vous dans des lieux publics\n\nPrivilégiez les endroits fréquentés et animés : cafés, centres commerciaux, parkings de supermarchés, postes de police. En journée de préférence. Si possible, venez accompagné(e).\n\n## Inspectez les objets avant l'échange\n\nPrenez le temps d'examiner l'objet en détail, de le tester et de le comparer à sa description. Un échange est un engagement mutuel : vérifiez avant de conclure.\n\n## Ne partagez jamais vos codes secrets\n\nAucun membre de l'équipe SamaTroc ne vous demandera jamais votre code PIN, votre mot de passe ou un code de vérification. Méfiez-vous de quiconque vous demande de « confirmer un code » par SMS ou appel.\n\n## Restez vigilant face aux demandes suspectes\n\n- Refusez tout paiement de « frais supplémentaires » en dehors de la plateforme\n- Méfiez-vous des offres trop belles pour être vraies\n- Ne partagez pas de documents sensibles (pièce d'identité, informations bancaires)\n- Si un comportement vous semble suspect, signalez-le immédiatement\n\n## Utilisez la messagerie interne\n\nLa messagerie SamaTroc garde une trace de vos échanges et protège vos coordonnées. Ne partagez votre numéro que lorsque vous êtes à l'aise.\n\n## Signalez les comportements inappropriés\n\nLe bouton « Signaler » est là pour ça. Chaque signalement est examiné par notre équipe. Les utilisateurs contrevenants peuvent être suspendus.\n\n## La plateforme est réservée aux majeurs\n\nLa première version de SamaTroc s'adresse aux personnes majeures.`,
    },
    {
      page: "CGU",
      title: "Conditions générales d'utilisation",
      body: `## 1. Objet\n\nLes présentes conditions régissent l'utilisation de la plateforme SamaTroc, service de mise en relation entre particuliers souhaitant échanger des objets au Sénégal.\n\n## 2. Rôle de SamaTroc\n\nSamaTroc est un intermédiaire technique. La plateforme ne rachète pas les objets, ne fixe pas leur valeur, ne gère ni la livraison ni l'exécution des échanges, et ne prend aucune commission sur les objets échangés. Les utilisateurs concluent et organisent leurs échanges en toute autonomie.\n\n## 3. Inscription et compte\n\nL'inscription est réservée aux personnes majeures. Les informations fournies doivent être exactes. Chaque utilisateur est responsable de la confidentialité de ses identifiants et de l'activité de son compte.\n\n## 4. Publication d'annonces\n\nLa publication d'une annonce est soumise au paiement de frais de publication à partir de 500 FCFA. Les frais portent sur le service de publication et ne constituent en aucun cas le prix ou la valeur de l'objet échangé. L'utilisateur garantit détenir le droit de disposer des objets proposés.\n\n## 5. Objets interdits\n\nSont notamment interdits : les biens illégaux ou réglementés sans autorisation, les produits stupéfiants, les armes, les médicaments, les biens volés, les contrefaçons, les animaux protégés, les documents d'identité, ainsi que tout objet dont la publication enfreindrait la loi sénégalaise ou les règles de la plateforme.\n\n## 6. Comportements interdits\n\nIl est interdit de : usurper l'identité d'autrui, publier de fausses annonces, harceler ou insulte les autres utilisateurs, contourner les frais de la plateforme, collecter les données d'autres utilisateurs, ou utiliser la plateforme à des fins commerciales non autorisées.\n\n## 7. Modération\n\nSamaTroc peut suspendre, refuser ou supprimer toute annonce ou tout compte enfreignant ces conditions, et ce sans indemnité. Les utilisateurs peuvent signaler les contenus via le bouton dédié.\n\n## 8. Paiements et remboursements\n\nLes frais de publication sont payés via les moyens de paiement mobile disponibles. Un remboursement des frais peut être accordé en cas d'échec technique imputable à la plateforme, sur demande à l'assistance avec la référence de transaction.\n\n## 9. Responsabilité\n\nSamaTroc ne garantit ni la conclusion des échanges, ni la qualité, la légalité ou la sécurité des objets proposés. Les utilisateurs restent responsables de leurs accords, de l'examen des objets et de l'organisation des remises. SamaTroc ne saurait être tenu responsable des litiges entre utilisateurs.\n\n## 10. Évolution des conditions\n\nCes conditions peuvent être modifiées. Les utilisateurs seront informés des changements significatifs. La poursuite de l'utilisation vaut acceptation.`,
    },
    {
      page: "PRIVACY",
      title: "Politique de confidentialité",
      body: `## 1. Données collectées\n\nSamaTroc collecte uniquement les données nécessaires : nom, prénom, adresse e-mail, numéro de téléphone (facultatif), ville, photos d'annonces et contenu des messages. Aucune donnée bancaire ni code PIN n'est collecté ou stocké.\n\n## 2. Finalités\n\nVos données servent à : créer et gérer votre compte, publier vos annonces, mettre en relation les utilisateurs, assurer la modération, et améliorer le service. Elles ne sont jamais revendues.\n\n## 3. Numéro de téléphone\n\nVotre numéro n'est jamais affiché publiquement sans votre accord explicite (paramètre « Afficher mon téléphone » dans votre profil). La messagerie interne permet d'échanger sans divulguer vos coordonnées.\n\n## 4. Messages\n\nLes conversations privées ne sont accessibles qu'aux participants. Elles peuvent être examinées uniquement dans le cadre d'un signalement traité par la modération, conformément aux règles de la plateforme.\n\n## 5. Conservation\n\nVos données sont conservées pendant la durée d'activation de votre compte. Vous pouvez demander la suppression de votre compte à tout moment ; certaines données peuvent être archivées pour obligations légales ou résolution de litiges.\n\n## 6. Sécurité\n\nNous appliquons des mesures techniques appropriées : mots de passe hachés, sessions chiffrées, contrôle d'accès strict, journalisation des actions sensibles, validation des données côté serveur.\n\n## 7. Cookies\n\nLa plateforme utilise un cookie de session strictement nécessaire à l'authentification. Aucun cookie publicitaire n'est déposé.\n\n## 8. Vos droits\n\nVous pouvez accéder à vos données, les rectifier ou demander leur suppression depuis votre profil ou en contactant l'assistance. Conformément à la loi sénégalaise sur les données personnelles, vous pouvez également saisir l'autorité de protection compétente.\n\n## 9. Contact\n\nPour toute question relative à vos données : contact@samatroc.sn`,
    },
    {
      page: "MODERATION",
      title: "Politique de modération",
      body: `## Principes\n\nLa modération SamaTroc vise à garantir une plateforme sûre, digne de confiance et conforme à la loi. Elle s'applique aux annonces, aux profils, aux messages et aux photos.\n\n## Ce qui est interdit\n\n- Objets illégaux, dangereux, volés ou contrefaits\n- Annonces trompeuses ou fausses\n- Contenu offensant, haineux ou discriminatoire\n- Spam, publicité non autorisée, arnaques\n- Sollicitation de paiements directs hors échange (« frais de dossier », codes de vérification, etc.)\n- Toute tentative de contourner les règles de la plateforme\n\n## Détection et traitement\n\n1. **Signalements utilisateurs** : chaque annonce, profil ou message peut être signalé. Chaque signalement est examiné par l'équipe.\n2. **Détection automatique** : les publications contenant des motifs suspects sont placées en file de modération avant leur mise en ligne.\n3. **Contrôle a posteriori** : l'équipe peut retirer une annonce déjà publiée si elle contrevient aux règles.\n\n## Sanctions\n\nSelon la gravité : avertissement, refus de l'annonce, suspension temporaire du compte, suspension définitive. Les tentatives de fraude caractérisée entraînent une suppression immédiate du compte.\n\n## Recours\n\nUn utilisateur sanctionné peut contacter l'assistance pour demander un réexamen. Chaque décision de modération est journalisée et tracée en interne.\n\n## Engagements de transparence\n\nLes utilisateurs sont informés du motif exact du refus ou du retrait de leurs annonces, et reçoivent une notification à chaque action de modération les concernant.`,
    },
    {
      page: "CONTACT",
      title: "Contact & assistance",
      body: `## Nous joindre\n\nL'équipe SamaTroc est disponible du lundi au samedi, de 9h à 18h (heure de Dakar).\n\n- **E-mail** : contact@samatroc.sn\n- **WhatsApp** : +221 77 000 00 00\n- **Téléphone** : +221 77 000 00 00\n\n## Avant de nous écrire\n\nLa plupart des réponses se trouvent dans la FAQ et les Conseils de sécurité. Pour toute question sur une transaction, conservez votre référence de paiement (format ST-PAY-XXXXXX) : elle accélère le traitement de votre demande.\n\n## Signaler un problème urgent\n\nPour un contenu manifestement illégal ou un comportement dangereux, utilisez le bouton « Signaler » présent sur chaque annonce et profil, ou indiquez « URGENT » dans l'objet de votre message.`,
    },
  ];
  for (const c of contents) {
    await db.siteContent.create({ data: c });
  }
  console.log("✓ Contenus éditoriaux (8 pages)");

  console.log("\n🎉 Seed terminé !");
  console.log("──────────────────────────────────────────────");
  console.log("Comptes de démonstration :");
  console.log("  Administration : admin@samatroc.sn / admin1234");
  console.log("  Utilisateurs   : moussa@demo.sn / demo1234 (et autres @demo.sn)");
  console.log("──────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error("❌ Erreur seed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
