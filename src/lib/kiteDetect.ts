// On-device object detection (COCO-SSD, which includes the "kite" class).
// Loaded lazily only in Create Kite so the main game stays light.

type Model = { detect: (img: HTMLCanvasElement, max?: number, minScore?: number) => Promise<{ class: string; score: number }[]> };
let modelPromise: Promise<Model> | null = null;

async function loadModel(): Promise<Model> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      const coco = await import('@tensorflow-models/coco-ssd');
      return (await coco.load({ base: 'lite_mobilenet_v2' })) as unknown as Model;
    })().catch((e) => {
      modelPromise = null;
      throw e;
    });
  }
  return modelPromise;
}

export interface DetectResult {
  available: boolean;
  kite: number;
  top: { label: string; score: number } | null;
}

export async function detectKite(src: HTMLCanvasElement, timeoutMs = 20000): Promise<DetectResult> {
  const run = async (): Promise<DetectResult> => {
    const model = await loadModel();
    // composite on a sky-blue backdrop, where kites usually appear
    const c = document.createElement('canvas');
    const k = Math.min(1, 480 / Math.max(src.width, src.height));
    const pad = 0.25;
    c.width = Math.round(src.width * k * (1 + pad * 2));
    c.height = Math.round(src.height * k * (1 + pad * 2));
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, '#7ec8f5');
    g.addColorStop(1, '#d6efff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(src, c.width * (pad / (1 + pad * 2)), c.height * (pad / (1 + pad * 2)), src.width * k, src.height * k);
    const preds = await model.detect(c, 10, 0.12);
    const kite = Math.max(0, ...preds.filter((p) => p.class === 'kite').map((p) => p.score));
    const others = preds.filter((p) => p.class !== 'kite').sort((a, b) => b.score - a.score);
    return { available: true, kite, top: others[0] ? { label: others[0].class, score: others[0].score } : null };
  };
  try {
    return await Promise.race([
      run(),
      new Promise<DetectResult>((resolve) => setTimeout(() => resolve({ available: false, kite: 0, top: null }), timeoutMs)),
    ]);
  } catch {
    return { available: false, kite: 0, top: null };
  }
}
