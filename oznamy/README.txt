Sem nahrávaj fotky k oznamom (napr. oznamy/turnaj-2026.jpg).
V súbore oznamy.json potom uveď cestu "oznamy/turnaj-2026.jpg".

Ako pridať oznam

Na GitHube nahraj fotku do priečinka oznamy/, napríklad oznamy/turnaj.jpg. Fotky radšej zmenši na šírku asi 1 600 px.
Otvor oznamy.json a pridaj nový záznam navrch. Poradie na webe je rovnaké ako v súbore.

{
  "datum": "12.10.2026",
  "nadpis": "Zmena tréningu",
  "text": "Tréning sa tento týždeň presúva na štvrtok o 17:00.",
  "fotky": ["oznamy/treningy.jpg"]
},

Fotiek môže byť viac, stačí ich oddeliť čiarkou. Voliteľne môžeš pridať odkaz: "odkaz": "nabor.html", "odkaz_text": "Viac →". Každý záznam okrem posledného musí končiť čiarkou. Ak ju zabudneš, stránka Oznamy napíše, že sa nepodarilo načítať, a treba skontrolovať čiarky v súbore.
