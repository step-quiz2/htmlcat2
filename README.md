# HTMLCat

Curs interactiu per aprendre a escriure **HTML i CSS** al navegador, en català,
i a fer-ho amb **codi net i ben estructurat**. Forma part de la mateixa sèrie que
[KarelCat](https://karelcat.step-quiz.net) i [PyCat](https://pycat.step-quiz.net).

> **Estat:** en construcció. Ja hi ha el capítol 1 i l'editor lliure; els altres capítols arribaran un a un.
> L'estat real del projecte és a [`docs/STATE.md`](docs/STATE.md).

---

## Què serà

Un curs per a alumnes d'ESO (≈ 15 anys) sense experiència prèvia en HTML ni CSS.
Tot funciona al navegador, sense instal·lar res. Cada capítol té exemples que
l'alumne pot editar i veure al moment, i exercicis amb correcció automàtica.

El navegador no avisa mai dels errors d'HTML i de CSS: els arregla en silenci.
Per això HTMLCat els fa visibles:

- **⚠ Problemes**: explica en català cada error o hàbit poc net, amb la línia i una pista.
- **🌳 Arbre**: mostra l'estructura que el navegador ha construït realment amb el teu codi.
- **✓ Comprovacions**: llista de requisits de cada exercici, amb ✓ o ✗ per a cadascun.

## Documentació

| Fitxer | Per a què serveix |
|---|---|
| [`docs/STATE.md`](docs/STATE.md) | Estat actual del projecte, decisions preses i tasques pendents. **Llegiu-lo primer.** |
| [`docs/CURRICULUM.md`](docs/CURRICULUM.md) | Pla de capítols i reptes, amb l'estat de cadascun. |
| [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) | Document de disseny inicial (en anglès), basat en l'anàlisi de PyCat i JSCat. |
| [`CLAUDE.md`](CLAUDE.md) | Normes per a les IA que hi treballin (en anglès). |

## Provar-ho a l'ordinador

Cal Python 3 (per servir el web) i Node 22 (per als tests). Des de l'arrel del projecte:

```bash
cd site && python3 -m http.server 8000
```

i obre <http://localhost:8000>. Els tests s'expliquen a [`docs/STATE.md`](docs/STATE.md) §4.

## Principis

- HTML, CSS i JavaScript «vanilla»: sense *frameworks*, sense pas de compilació, sense dependències.
- Interfície i continguts en català.
- Privacitat: sense analítiques, sense galetes, sense peticions a servidors externs.
- Tests automàtics des del primer dia.

<!-- atribucio-centre:inici -->

---

Material desenvolupat per **David Arso Civil** per al Departament de Matemàtiques de l'INS Miquel Tarradell.
Contingut sota CC BY-NC-SA 4.0, codi sota llicència MIT. Vegeu [`LLICENCIA.md`](LLICENCIA.md).

<!-- atribucio-centre:final -->
