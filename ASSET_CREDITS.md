# Créditos e licenças de assets

Toda arte, som e interface usados pelo jogo devem ter origem e licença registradas aqui
(handoff de estilo artístico, seção 8). Um asset gratuito não é automaticamente liberado para uso comercial.

| Asset | Caminho | Autor / fonte | Licença | Uso comercial | Observações |
|---|---|---|---|---|---|
| Sprites dos personagens | `assets/characters/` | Projeto (modelados e renderizados no Blender por `tools/art/characters.py`) | Própria | Sim | Cenas-fonte em `assets/source/characters/` |
| Objetos de cenário | `assets/environment/objects/` | Projeto (`tools/art/props.py`, Blender) | Própria | Sim | Árvores, rochas, caixa, barril, estandartes |
| Ícones de habilidades | `assets/ui/icons/` | Projeto (SVG gerado por `tools/art/icons.mjs`) | Própria | Sim | |
| Chão e muralhas | `src/render/Renderer.js` | Projeto (desenhados por código) | Própria | Sim | |
| Personagens provisórios | `src/render/PlaceholderArt.js` | Projeto (desenhados por código) | Própria | Sim | Substituídos pelos sprites quando o manifesto marcar a classe como `ready` |
| Fonte Blender | — | Blender Foundation | GPL (ferramenta) | Sim | A licença do Blender não se aplica às imagens renderizadas |
| Efeitos sonoros | `src/audio/Sfx.js` | Projeto (sintetizados com Web Audio) | Própria | Sim | |

Ao adicionar um asset externo (Kenney, Mixamo, Poly Haven etc.), inclua uma linha nesta tabela antes do commit.
