/**
 * Génération des visuels SamaTroc :
 *  - 16 remplacements (personnages sénégalais / suppression des watermarks et captures erronées)
 *  - 10 visuels pour les nouvelles annonces
 * Sortie : public/images/listings/*.jpg (JPEG 4:3 via sharp)
 *
 * Exécution : bun scripts/generate-listing-images.ts
 */
import ZAI from "z-ai-web-dev-sdk";
import sharp from "sharp";
import fs from "fs";
import path from "path";

const OUT_DIR = path.join(process.cwd(), "public", "images", "listings");
const SIZE = "1152x864"; // 4:3 — correspond à l'aspect-[4/3] des cartes

type Job = { file: string; prompt: string };

const STYLE =
  "realistic photography, natural lighting, sharp focus, high quality, 4:3, no text, no watermark, no logo";

const jobs: Job[] = [
  // ===== REMPLACEMENTS (annonces existantes) =====
  {
    file: "clothes-1.jpg",
    prompt: `Neatly folded stack of women's second-hand clothing, blue jeans, colorful tops and scarves on a light wooden table, bright daylight, second-hand marketplace listing photo, ${STYLE}`,
  },
  {
    file: "clothes-2.jpg",
    prompt: `Women's clothes laid out flat on a clean bed: dresses, jeans and African wax print fabric mixed with modern garments, bright daylight, marketplace listing photo, ${STYLE}`,
  },
  {
    file: "clothes-3.jpg",
    prompt: `Young Senegalese woman with dark skin smiling warmly, holding a neat stack of folded colorful clothes in her arms, sunny Dakar neighborhood street blurred in background, ${STYLE}`,
  },
  {
    file: "sandals-1.jpg",
    prompt: `Close-up of elegant black flat leather strappy sandals worn by a Senegalese woman with dark skin, standing on a tiled terrace, visible from knees down, bright daylight, ${STYLE}`,
  },
  {
    file: "handbag-1.jpg",
    prompt: `Smiling Senegalese woman with dark skin wearing a denim jacket, holding a camel brown leather handbag on her shoulder, sunny Dakar street blurred in background, ${STYLE}`,
  },
  {
    file: "handbag-2.jpg",
    prompt: `Elegant camel brown leather handbag with gold clasp and removable strap placed on a light wooden table, clean studio product photography, soft shadows, ${STYLE}`,
  },
  {
    file: "football-3.jpg",
    prompt: `Official size 5 soccer ball with orange and white panels, very slightly used condition, resting alone on neatly cut green grass, bright sunny daylight, low side angle close-up, softly blurred green field in background, no people, no children, empty field, product photography, ${STYLE}`,
  },
  {
    file: "maillot-1.jpg",
    prompt: `Plain green and white football jersey size M, completely blank fabric without any brand mark, no logo, no crest, no emblem, no writing anywhere, neatly laid flat on a light wooden table, short sleeves, crisp fabric folds, small blank white price tag attached, top view product photography, no people, realistic photography, natural lighting, sharp focus, high quality, ${STYLE}`,
  },
  {
    file: "maillot-2.jpg",
    prompt: `Green and white official football jersey on a wooden hanger against a plain light wall, brand new with blank paper tag, front view, soft natural window light, product photography, no people, no brand logo, no text, realistic photography, sharp focus, high quality, ${STYLE}`,
  },
  {
    file: "laptopbag-1.jpg",
    prompt: `Modern dark grey reinforced laptop backpack standing upright on a light wooden desk, padded 15 inch laptop bag, water-resistant fabric with subtle texture, side pocket with USB charging port visible, clean bright indoor background, product photography, no people, no brand logo, no text, realistic photography, natural lighting, sharp focus, high quality, ${STYLE}`,
  },
  {
    file: "laptopbag-2.jpg",
    prompt: `Dark grey laptop backpack open showing padded compartment with a silver 15 inch laptop sliding inside, top-down angle on a light wooden desk, bright indoor light, product photography, no brand logo, no text, realistic photography, sharp focus, high quality, ${STYLE}`,
  },
  {
    file: "football-2.jpg",
    prompt: `Classic white and red soccer ball on green grass in front of a goal net, blue sky, slight low angle, ${STYLE}`,
  },
  {
    file: "guitar-1.jpg",
    prompt: `Smiling young Senegalese man with dark skin playing a wooden acoustic guitar, sitting in a colorful living room with wax print cushions, warm light, ${STYLE}`,
  },
  {
    file: "guitar-2.jpg",
    prompt: `Wooden acoustic guitar leaning against a white wall on a polished wooden floor, soft natural window light, ${STYLE}`,
  },
  {
    file: "books-1.jpg",
    prompt: `Neat stack of French law school textbooks with a notebook and pen on a wooden student desk, warm light, ${STYLE}`,
  },
  {
    file: "books-2.jpg",
    prompt: `Stack of French paperback novels arranged on a shelf near a bright window, cozy student room, soft light, ${STYLE}`,
  },
  {
    file: "kidsclothes-1.jpg",
    prompt: `Adorable little Senegalese girl with dark skin and braided hair, smiling while holding a big pile of colorful folded children's clothes in her arms, bright cheerful room, ${STYLE}`,
  },
  {
    file: "kidsclothes-3.jpg",
    prompt: `Colorful children's clothes folded in neat stacks with small wooden educational toys on a wooden table, bright nursery, ${STYLE}`,
  },
  {
    file: "stroller-2.jpg",
    prompt: `Senegalese mother with dark skin wearing a colorful dress, pushing a modern three-wheel baby stroller on a sunny Dakar street, smiling, palm trees in background, ${STYLE}`,
  },
  {
    file: "sofa-1.jpg",
    prompt: `Senegalese mother and her young daughter, both with dark skin, sitting together on a dark gray corduroy sofa reading a children's book, bright living room with large windows, warm atmosphere, ${STYLE}`,
  },
  // ===== NOUVELLES ANNONCES =====
  {
    file: "microwave-1.jpg",
    prompt: `Clean white microwave oven on a kitchen counter, door closed, control panel visible, bright modern kitchen, product listing photo, ${STYLE}`,
  },
  {
    file: "sneakers-1.jpg",
    prompt: `Pair of white and blue sport sneakers for men placed on a concrete floor, almost new condition, laces tied, product listing photo, ${STYLE}`,
  },
  {
    file: "schoolbag-1.jpg",
    prompt: `Sturdy navy blue school backpack with laptop compartment standing on a student desk with books, reinforced stitching, product listing photo, ${STYLE}`,
  },
  {
    file: "carseat-1.jpg",
    prompt: `Baby car seat group 1 with five-point harness and side protection, dark gray fabric, installed in the back seat of a clean car, product listing photo, ${STYLE}`,
  },
  {
    file: "fridge-1.jpg",
    prompt: `Silver two-door combined refrigerator with freezer, standing in a bright clean kitchen, product listing photo, ${STYLE}`,
  },
  {
    file: "sewingmachine-1.jpg",
    prompt: `Vintage mechanical sewing machine on a wooden table with colorful African wax fabric spool nearby, warm afternoon light, ${STYLE}`,
  },
  {
    file: "wax-1.jpg",
    prompt: `Stack of vibrant African wax print fabrics (pagnes) folded neatly showing colorful geometric patterns, Senegalese fabric shop background, ${STYLE}`,
  },
  {
    file: "djembe-1.jpg",
    prompt: `Hand-carved wooden djembe drum with goat skin top and carved African patterns, standing on an earthen floor, warm light, product listing photo, ${STYLE}`,
  },
  {
    file: "samsung-1.jpg",
    prompt: `Modern black Android smartphone displayed on a wooden table next to its wall charger and cable, screen off, product listing photo, ${STYLE}`,
  },
  {
    file: "bed-1.jpg",
    prompt: `Solid wood bed frame with a firm mattress 140x190 in a bright tidy bedroom with white walls and curtains, product listing photo, ${STYLE}`,
  },
];

async function generateOne(zai: Awaited<ReturnType<typeof ZAI.create>>, job: Job, attempt = 1): Promise<boolean> {
  try {
    const res = await zai.images.generations.create({ prompt: job.prompt, size: SIZE });
    const b64 = res?.data?.[0]?.base64;
    if (!b64) throw new Error("réponse vide du générateur");
    const buffer = Buffer.from(b64, "base64");
    const jpg = await sharp(buffer).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
    const out = path.join(OUT_DIR, job.file);
    fs.writeFileSync(out, jpg);
    console.log(`✓ ${job.file} (${Math.round(jpg.length / 1024)} Ko)`);
    return true;
  } catch (e) {
    console.error(`✗ ${job.file} (essai ${attempt}) : ${(e as Error).message}`);
    if (attempt < 6) {
      await new Promise((r) => setTimeout(r, 3000 * attempt));
      return generateOne(zai, job, attempt + 1);
    }
    return false;
  }
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const zai = await ZAI.create();
  const failed: string[] = [];
  const CONCURRENCY = 2;
  let index = 0;

  async function worker(_wid: number) {
    while (index < jobs.length) {
      const job = jobs[index++];
      const ok = await generateOne(zai, job);
      if (!ok) failed.push(job.file);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));

  console.log("\n──────────────────────────────────────");
  console.log(`${jobs.length - failed.length}/${jobs.length} images générées`);
  if (failed.length) {
    console.log("Échecs :", failed.join(", "));
    process.exitCode = 1;
  }
}

main();
