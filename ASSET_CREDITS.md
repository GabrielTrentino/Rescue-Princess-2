# Créditos e licenças de assets

Toda arte, som e interface usados pelo jogo devem ter origem e licença registradas aqui
(handoff de estilo artístico, seção 8). Um asset gratuito não é automaticamente liberado para uso comercial.

| Asset | Caminho | Autor / fonte | Licença | Uso comercial | Observações |
|---|---|---|---|---|---|
| Personagens 3D e animações (Knight, Barbarian, Mage, Rogue, Rogue_Hooded) | `assets/models/characters/` | KayKit Adventurers Character Pack 1.0, Kay Lousberg ([kaylousberg.com](https://www.kaylousberg.com), [GitHub](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0)) | CC0 1.0 | Sim | Convertidos para .glb e com animações separadas em `anims.glb` por `tools/assets/build-models.mjs`. Licença original em `assets/models/LICENSE-KayKit-Adventurers.txt` |
| Armas 3D (espada, escudo, machado, cajado, besta, adaga, flecha) | `assets/models/weapons/` | KayKit Adventurers Character Pack 1.0, Kay Lousberg | CC0 1.0 | Sim | Mesma origem acima |
| Construções, árvores, rochas, montanhas e objetos de cenário | `assets/models/world/` | KayKit Medieval Hexagon Pack 1.0, Kay Lousberg ([GitHub](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0)) | CC0 1.0 | Sim | Licença original em `assets/models/LICENSE-KayKit-Medieval-Hexagon.txt` |
| Motor 3D | `vendor/three/` | Three.js 0.170.0 ([threejs.org](https://threejs.org)) | MIT | Sim | Licença em `vendor/three/LICENSE` |
| Alabarda, martelo, barricada e armadilha | `src/render3d/props.js` | Projeto (modelados por código) | Própria | Sim | Mesmo estilo low-poly da KayKit |
| Chão, caminhos, praças e muralhas | `src/render3d/WorldBuilder.js` | Projeto (desenhados por código) | Própria | Sim | |
| Ícones de habilidades | `assets/ui/icons/` | Projeto (SVG gerado por `tools/art/icons.mjs`) | Própria | Sim | |
| Efeitos sonoros | `src/audio/Sfx.js` | Projeto (sintetizados com Web Audio) | Própria | Sim | |

Os arquivos originais baixados por `tools/assets/fetch-kaykit.mjs` ficam em `assets/vendor/` (fora do Git);
só os modelos convertidos e otimizados de `assets/models/` são versionados.

Ao adicionar um asset externo (Kenney, Quaternius, Poly Pizza etc.), inclua uma linha nesta tabela antes do commit.
