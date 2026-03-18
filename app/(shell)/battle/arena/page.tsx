import BattleArena from "../../../../components/battle/battle-arena";
import ViewMarker from "../../../../components/view-marker";
import Script from "next/script";
import { Suspense } from "react";

export default function Page() {
  return (
    <>
      <Script id="studium-arena-subview" strategy="beforeInteractive">
        {`try{document.body.dataset.subview="battle-arena";var d=document.getElementById("arenaDock");if(d)d.removeAttribute("hidden");}catch{}`}
      </Script>
      <ViewMarker view="battle" label="Arena" desc="Duel: answer questions, manage streaks, climb ranks." />
      <Suspense fallback={null}>
        <BattleArena />
      </Suspense>
    </>
  );
}
