import data from "./question-bank.json";

export type BattleMaterialId = "quests" | "calculus" | "data_structures" | "physics";

export type BattleQuestion = {
  id: string;
  materialId: Exclude<BattleMaterialId, "quests">;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

function normalize(items: any): BattleQuestion[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((q) => {
      const id = String(q?.id || "").trim();
      const materialId = String(q?.materialId || "").trim() as any;
      const prompt = String(q?.prompt || "").trim();
      const options = Array.isArray(q?.options) ? q.options.map((x: any) => String(x)) : [];
      const correctIndex = Number(q?.correctIndex);
      const explanation = q?.explanation ? String(q.explanation) : undefined;
      if (!id || !prompt) return null;
      if (materialId !== "calculus" && materialId !== "data_structures" && materialId !== "physics") return null;
      if (!Number.isFinite(correctIndex) || correctIndex < 0 || correctIndex > 3) return null;
      while (options.length < 4) options.push("—");
      return { id, materialId, prompt, options: options.slice(0, 4), correctIndex, explanation } as BattleQuestion;
    })
    .filter(Boolean) as BattleQuestion[];
}

export const QUESTION_BANK: BattleQuestion[] = normalize(data);
