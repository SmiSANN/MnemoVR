import { strings } from "../lib/strings";

export function AboutSection() {
  return (
    <section className="bg-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-2">
        {strings.about.title}
      </h3>
      <p className="text-xs text-slate-300">
        Version 1.1.1 - MnemoVR VRChat Photo Album & World Ranking
      </p>
    </section>
  );
}
