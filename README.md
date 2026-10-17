# Resgate da Princesa

Jogo de ação em equipes em **3D isométrico**, inspirado nas mecânicas de *Fat Princess*
(referência de design, sem assets ou conteúdo do jogo original). Partidas de 8 contra 8 em que
todo mundo começa como **Aldeão** e vira uma classe ao pegar uma arma no chão. Cada classe tem uma
construção que fabrica a sua arma; construções recebem melhorias e podem ser destruídas.
Feito em HTML, CSS e JavaScript modular, com Three.js (incluído em `vendor/`) para o 3D.

## Como jogar localmente

Os módulos ES precisam ser servidos por HTTP (abrir o `index.html` direto do disco não funciona).
Com Node.js 18 ou mais recente:

```bash
npm start            # abre em http://localhost:8000
# ou, em outra porta:
node scripts/serve.js 8080
```

Sem Node, qualquer servidor estático serve, por exemplo `python3 -m http.server 8000`.

## Controles

| Ação | Tecla |
|---|---|
| Mover (relativo à câmera) | `W` `A` `S` `D` ou setas |
| Mirar | Mouse |
| Ataque básico | Clique esquerdo (segurar) ou `J` |
| Habilidades 1 a 5 | `1` `2` `3` `4` `5` |
| Pegar arma do chão | `F` |
| Melhorar construção da equipe | `G` (perto dela) |
| Girar a câmera | `Q` / `E` ou arrastar com o botão do meio |
| Zoom | Roda do mouse |
| Pausa | `Esc` ou `P` |
| Reiniciar partida | `Backspace` (ou pelo menu de pausa) |

As teclas ficam em `DEFAULT_BINDINGS` (`src/core/InputManager.js`) e são identificadas pela posição
física, então funcionam igual em teclados ABNT2 e US.

## Regras da partida

- Duas equipes de 8: você e 7 aliados (azul) contra 8 bots vermelhos.
- **Todos começam como Aldeão.** Cada construção fabrica a arma de uma classe e a deixa no suporte em frente
  a ela. Pegar a arma (`F`) toca a animação de transformação e o personagem vira aquela classe.
  Quem já tem arma deixa a antiga no chão.
- **Quem morre derruba a arma** no lugar; qualquer personagem, de qualquer equipe, pode pegá-la.
  Quem reaparece volta como Aldeão.
- **Construções:** Quartel (Guerreiro), Serraria (Bárbaro), Torre do Mago (Mago), Campo de Tiro (Arqueiro),
  Taverna (Mercenário), Ferraria (Alabardeiro), Mina (Engenheiro) e o Castelo. Elas não têm tempo limite,
  mas qualquer personagem pode destruí-las. Ruínas podem ser reconstruídas por um Engenheiro, e as
  ruínas de mercado no meio do mapa geram ouro para a equipe que as reconstruir.
- **Melhorias (`G`):** custam ouro da equipe (150 para o nível 2, 300 para o nível 3). Cada nível aumenta a
  vida da construção, fabrica armas mais rápido e de nível maior (★, mais dano e vida).
  O ouro vem com o tempo, por abates e por construções inimigas destruídas.
- **Habilidades sem recarga:** cada classe tem uma barra de ação (Estamina, Vigor, Fúria, Mana, Foco,
  Energia, Materiais) que se recupera com o tempo; cada habilidade gasta parte dela. A Fúria do Bárbaro
  cresce batendo e apanhando.
- **Engenheiro:** ergue barricadas, torres de flechas, catapultas e armadilhas de espinhos, e repara
  construções e defesas. As defesas não somem com o tempo, mas podem ser destruídas por qualquer inimigo.
- **Vitória:** derrubar o castelo inimigo ou conquistar a base inimiga (ficar nela com mais atacantes que
  defensores). Se o tempo acabar, vence quem avançou mais na base adversária, depois quem perdeu menos
  construções e por fim quem eliminou mais.
- Quantidade de bots, duração, respawn, tempo de conquista e dificuldade são ajustáveis em **Configurações**
  (salvas no navegador).

## Classes e habilidades

| Classe | Barra de ação | Habilidades (custo) |
|---|---|---|
| Aldeão | Estamina (100) | Disparada (40), Pedrada (25) |
| Guerreiro | Vigor (100) | Golpe Poderoso (20), Investida (25), Postura Defensiva (30), Provocação (35), Última Resistência (85) |
| Bárbaro | Fúria (100) | Fúria (30), Golpe Brutal (25), Giro Selvagem (30), Quebra-Guarda (40), Fúria Berserker (80) |
| Mago | Mana (150) | Projétil Arcano (25), Explosão Elemental (40), Raio Místico (30), Campo Congelante (40), Tempestade Arcana (105) |
| Arqueiro (besta) | Foco (100) | Disparo Preciso (20), Chuva de Flechas (30), Flecha Perfurante (25), Disparo de Recuo (30), Rajada Mortal (75) |
| Mercenário | Energia (100) | Corte Rápido (20), Passo Sombrio (35), Golpe Oportunista (25), Bomba de Fumaça (40), Execução (80) |
| Alabardeiro | Vigor (100) | Estocada (20), Varredura (25), Gancho de Alabarda (30), Formação Defensiva (30), Domínio do Campo (80) |
| Engenheiro | Materiais (150) | Barricada (30), Torre de Flechas (60), Catapulta (90), Armadilha de Espinhos (25), Reparar (30) |

Atributos ficam em `src/classes/classDefinitions.js`, habilidades em `src/classes/abilityDefinitions.js` e
construções e defesas em `src/world/Structures.js`, todos como dados. Balancear é editar números, não código.

## Testes

```bash
npm test
```

Usa o executor nativo do Node (`node:test`), sem instalar nada. Os testes cobrem fórmula de dano,
barras de ação, todas as habilidades, armas no chão e transformação, construções (produção, melhoria,
destruição e reconstrução), defesas do Engenheiro, colisões, pathfinding, IA, partidas completas simuladas
só com bots e a existência de todos os modelos 3D e animações usados. O GitHub Actions roda
os mesmos testes em cada pull request.

Para depurar no navegador, abra `index.html?debug`: o objeto `game` fica disponível no console.

## Arquitetura

```text
index.html, styles/            Página, menus e HUD (DOM + CSS)
src/main.js                    Ponto de entrada
src/config.js                  Parâmetros de partida e dificuldade
src/core/                      Game (cenas), GameLoop (passo fixo), InputManager, EventBus, math
src/world/                     World (simulação), Structures (construções e defesas), Weapons (armas no chão),
                               CollisionSystem, Pathfinding (A*), ObjectiveManager
src/entities/                  Character, Projectile, PlayerController
src/combat/                    DamageSystem, CombatSystem, AbilitySystem, CooldownSystem, StatusEffects
src/classes/                   Definições das classes, barras de ação e habilidades (dados)
src/ai/                        BotController (máquina de estados), StateMachine, TargetSelector
src/systems/                   MatchManager, RespawnSystem, Settings
src/render/                    Effects (efeitos visuais a partir de eventos), palette
src/render3d/                  Renderer3D, CameraRig, CharacterView, WorldBuilder, Overlay, Assets, props
src/ui/                        HUD, Screens (menu, guia das classes, configurações, pausa, resultado)
src/audio/                     Sfx (sons sintetizados)
src/data/maps.js               Mapas como dados
assets/models/                 Modelos 3D (.glb) prontos para o jogo
vendor/three/                  Three.js 0.170 (MIT)
tools/assets/                  Download e conversão dos modelos KayKit
tests/                         Testes automatizados
```

Princípios seguidos (handoff, seção 11.4):

- **Lógica separada da renderização.** `World`, combate, IA e partida não conhecem DOM, Canvas nem Three.js e
  rodam no Node, num plano 2D em pixels; o renderizador 3D só lê o estado (40 px do jogo = 1 unidade 3D). Eventos (`EventBus`) ligam lógica, efeitos visuais, HUD e sons.
- **Passo fixo de simulação** (1/60 s): a velocidade do jogo não muda com a taxa de quadros do monitor.
- **Um único executor de habilidades.** Toda habilidade passa pela mesma validação (vivo, recurso suficiente,
  estado) e é composta por efeitos genéricos: `melee`, `dash`, `buff`, `taunt`, `projectile`, `aoe`, `zone`,
  `build` e `repair`. Uma tentativa inválida não gasta a barra de ação.
- **Dano centralizado** em `DamageSystem.computeDamage` (armadura, poder mágico, crítico, modificadores).
- **Atributos-base imutáveis**; efeitos temporários são modificadores multiplicativos que expiram sozinhos.
- **Bots com máquina de estados** (`idle`, `follow`, `seek`, `chase`, `attack`, `retreat`, `defend`, `arm`, `build`, `dead`),
  que vão buscar armas, atacam construções e, como Engenheiros, constroem defesas e reparam ruínas;
  decisões em intervalos configuráveis, pathfinding A* com suavização e recuperação quando ficam presos.
  Cada habilidade descreve quando um bot deve usá-la (campo `ai`).
- **Objetivo como sistema independente** (`CaptureObjective`), substituível por outros modos (ex.: resgate).

## Arte 3D

Personagens, animações, armas, construções e cenário vêm dos pacotes **KayKit** de Kay Lousberg
(Adventurers Character Pack e Medieval Hexagon Pack), licença **CC0**. Origem e licença de cada asset estão
em [`ASSET_CREDITS.md`](ASSET_CREDITS.md).

| O quê | Onde |
|---|---|
| Personagens (sem animações, ~300 KB cada) e `anims.glb` com as animações compartilhadas | `assets/models/characters/` |
| Armas | `assets/models/weapons/` |
| Construções (azul e vermelho), ruínas, árvores, rochas, montanhas e objetos | `assets/models/world/` |
| Alabarda, martelo, barricada e armadilha (feitos por código) | `src/render3d/props.js` |
| Aparência de cada classe (modelo, peças visíveis, arma, animações) | `src/render3d/looks.js` |
| Ícones das habilidades | `assets/ui/icons/*.svg` (`node tools/art/icons.mjs`) |

A câmera fica inclinada a 52°, acompanha o jogador e gira em passos de 45°. Construções que ficam entre a
câmera e o jogador ficam translúcidas. Para baixar e converter os modelos de novo (precisa de
`npm install @gltf-transform/core @gltf-transform/functions` num diretório à parte, ou no projeto):

```bash
node tools/assets/fetch-kaykit.mjs    # baixa os originais para assets/vendor/kaykit (fora do Git)
node tools/assets/build-models.mjs    # converte para .glb, separa as animações e grava em assets/models
```

## Publicação no GitHub Pages

Todos os caminhos são relativos, então o repositório pode ser publicado como site estático:
em *Settings → Pages*, escolha a branch `main` e a pasta raiz.

## Estado atual e limitações conhecidas

- Os valores numéricos (custos, vida das construções, ouro) ainda precisam de testes de jogo com pessoas.
- Partidas só entre bots costumam terminar por tempo, com algumas construções destruídas pelo caminho;
  o jogador costuma decidir a partida.
- Um único mapa (`Vale das Duas Muralhas`, 4800 × 2800) e um único modo.
- O carregamento inicial baixa cerca de 9 MB de modelos.
- Sons gravados, multiplayer e controles por gamepad ficam para etapas futuras.
