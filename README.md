# Resgate da Princesa

Jogo de ação em equipes com visão superior inclinada, inspirado nas mecânicas de *Fat Princess*
(referência de design, sem assets ou conteúdo do jogo original). Seis classes, 30 habilidades,
bots aliados e inimigos e um objetivo de captura e defesa de bases. Feito em HTML, CSS e
JavaScript modular com Canvas 2D, sem dependências externas.

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
| Mover (8 direções) | `W` `A` `S` `D` ou setas |
| Mirar | Mouse |
| Ataque básico | Clique esquerdo (segurar) ou `J` |
| Habilidades 1 a 5 | `Q` `E` `R` `F` `Espaço` |
| Pausa | `Esc` ou `P` |
| Reiniciar partida | `Backspace` (ou pelo menu de pausa) |

As teclas ficam em `DEFAULT_BINDINGS` (`src/core/InputManager.js`) e são identificadas pela posição
física, então funcionam igual em teclados ABNT2 e US.

## Regras da partida

- Duas equipes: você e os aliados (azul) contra os bots vermelhos.
- Cada equipe tem uma base. Ficar dentro da base inimiga com **mais atacantes que defensores**
  aumenta o progresso de conquista; defensores revertem o progresso. Chegar a 100% vence a partida.
- Personagens derrotados reaparecem na própria base após alguns segundos. Dentro da própria base,
  sem inimigos presentes, a vida se recupera aos poucos.
- Se o tempo acabar, vence quem avançou mais na base adversária; persistindo o empate, quem eliminou mais.
- Quantidade de bots, duração, respawn, tempo de conquista e dificuldade são ajustáveis em **Configurações**
  (salvas no navegador).

## Classes e habilidades

| Classe | Função | Habilidades (cooldown) |
|---|---|---|
| Guerreiro | Linha de frente | Golpe Poderoso (6 s), Investida (10 s), Postura Defensiva (14 s), Provocação (16 s), Última Resistência (50 s) |
| Bárbaro | Dano corpo a corpo | Fúria (14 s), Golpe Brutal (10 s), Giro Selvagem (12 s), Quebra-Guarda (18 s), Fúria Berserker (45 s) |
| Mago | Dano mágico e controle | Projétil Arcano (5 s), Explosão Elemental (14 s), Raio Místico (8 s), Campo Congelante (12 s), Tempestade Arcana (45 s) |
| Arqueiro | Combate à distância | Disparo Preciso (5 s), Chuva de Flechas (12 s), Flecha Perfurante (9 s), Disparo de Recuo (14 s), Rajada Mortal (40 s) |
| Mercenário | Flanqueamento | Corte Rápido (7 s), Passo Sombrio (16 s), Golpe Oportunista (10 s), Bomba de Fumaça (18 s), Execução (45 s) |
| Alabardeiro | Controle de espaço | Estocada (5 s), Varredura (9 s), Gancho de Alabarda (14 s), Formação Defensiva (12 s), Domínio do Campo (45 s) |

Atributos ficam em `src/classes/classDefinitions.js` e habilidades em `src/classes/abilityDefinitions.js`,
ambos como dados. Balancear é editar números, não código.

## Testes

```bash
npm test
```

Usa o executor nativo do Node (`node:test`), sem instalar nada. Os testes cobrem fórmula de dano,
cooldowns, as 30 habilidades, colisões e movimento, pathfinding, IA e partidas completas simuladas
só com bots (vitória, derrota, reinício e ausência de personagens duplicados). O GitHub Actions roda
os mesmos testes em cada pull request.

Para depurar no navegador, abra `index.html?debug`: o objeto `game` fica disponível no console.

## Arquitetura

```text
index.html, styles/            Página, menus e HUD (DOM + CSS)
src/main.js                    Ponto de entrada
src/config.js                  Parâmetros de partida e dificuldade
src/core/                      Game (cenas), GameLoop (passo fixo), InputManager, EventBus, math
src/world/                     World (simulação), CollisionSystem, Pathfinding (A*), ObjectiveManager
src/entities/                  Character, Projectile, PlayerController
src/combat/                    DamageSystem, CombatSystem, AbilitySystem, CooldownSystem, StatusEffects
src/classes/                   Definições das classes e das 30 habilidades (dados)
src/ai/                        BotController (máquina de estados), StateMachine, TargetSelector
src/systems/                   MatchManager, RespawnSystem, Settings
src/render/                    Camera, Renderer, Effects, SpriteManager, PlaceholderArt, palette
src/ui/                        HUD, Screens (menu, seleção de classe, configurações, pausa, resultado)
src/audio/                     Sfx (sons sintetizados)
src/data/maps.js               Mapas como dados
assets/                        Estrutura do pipeline de arte + manifestos
tests/                         Testes automatizados
```

Princípios seguidos (handoff, seção 11.4):

- **Lógica separada da renderização.** `World`, combate, IA e partida não conhecem DOM nem Canvas e rodam
  no Node; o renderizador só lê o estado. Eventos (`EventBus`) ligam lógica, efeitos visuais, HUD e sons.
- **Passo fixo de simulação** (1/60 s): a velocidade do jogo não muda com a taxa de quadros do monitor.
- **Um único executor de habilidades.** Toda habilidade passa pela mesma validação (vivo, disponível,
  cooldown, estado) e é composta por efeitos genéricos: `melee`, `dash`, `buff`, `taunt`, `projectile`,
  `aoe` e `zone`. Uma tentativa inválida não consome a habilidade.
- **Dano centralizado** em `DamageSystem.computeDamage` (armadura, poder mágico, crítico, modificadores).
- **Atributos-base imutáveis**; efeitos temporários são modificadores multiplicativos que expiram sozinhos.
- **Bots com máquina de estados** (`idle`, `follow`, `seek`, `chase`, `attack`, `retreat`, `defend`, `dead`),
  decisões em intervalos configuráveis, pathfinding A* com suavização e recuperação quando ficam presos.
  Cada habilidade descreve quando um bot deve usá-la (campo `ai`).
- **Objetivo como sistema independente** (`CaptureObjective`), substituível por outros modos (ex.: resgate).

## Arte e sprites

A direção de arte segue o handoff de estilo artístico: *Cartoon 3D Stylized*. Os personagens e os objetos do
cenário são **modelos 3D feitos no Blender** (formas simples, proporção "chibi", cores chapadas com leve brilho)
renderizados como sprites 2D com contorno escuro, vistos pela mesma câmera inclinada (50°) usada no jogo.

| O quê | Onde | Como é gerado |
|---|---|---|
| 6 classes × 2 equipes × 5 animações (`idle`, `run`, `attack`, `hurt`, `death`), 4 direções | `assets/characters/<classe>/<classe>_<equipe>_<animação>.png` | `tools/art/characters.py` |
| Cenas-fonte editáveis dos personagens | `assets/source/characters/<classe>.blend` | `tools/art/characters.py` |
| Árvores, rochas, caixa, barril e estandartes | `assets/environment/objects/*.png` | `tools/art/props.py` |
| Ícones das 30 habilidades e dos ataques básicos | `assets/ui/icons/*.svg` | `node tools/art/icons.mjs` |
| Chão (grama, flores, calçamento, praças) e muralhas de pedra | gerados em tempo real | `src/render/Renderer.js` |

Cada folha tem quadros de 256×256 (colunas = quadros, linhas = direções `down`, `left`, `right`, `up`).
Os manifestos `assets/manifests/characters.json` e `environment.json` dizem quadros, FPS, ponto dos pés e escala;
o renderizador lê só os manifestos. Se um arquivo faltar, a classe volta para a arte provisória desenhada por
código (`PlaceholderArt.js`), e `npm test` acusa o arquivo ausente. A colisão usa o raio da classe e nunca depende
do tamanho do sprite.

Para gerar a arte de novo, use um Python com o Blender como módulo e o Pillow
(`pip install bpy pillow`; o `bpy` acompanha a versão de Python suportada pelo Blender):

```bash
python tools/art/characters.py                     # todas as classes (ou --classes warrior mage)
python tools/art/props.py                          # objetos de cenário
python tools/art/optimize.py                       # reduz as folhas para paleta de 256 cores
node tools/art/icons.mjs                           # ícones
```

`characters.py --preview` renderiza só alguns quadros para revisar modelos rapidamente. Origem e licença de
qualquer asset externo devem ser registradas em [`ASSET_CREDITS.md`](ASSET_CREDITS.md).

## Publicação no GitHub Pages

Todos os caminhos são relativos, então o repositório pode ser publicado como site estático:
em *Settings → Pages*, escolha a branch `main` e a pasta raiz.

## Estado atual e limitações conhecidas

- Fases 1 a 6 do roadmap implementadas; da fase 7 há efeitos visuais, sons sintetizados e ajustes iniciais
  de balanceamento. Os valores numéricos ainda precisam de testes de jogo com pessoas.
- Partidas só entre bots tendem a terminar por tempo (desempate por avanço e eliminações): as bases são
  fáceis de defender porque os defensores reaparecem dentro delas. O jogador costuma decidir a partida.
- Um único mapa (`Vale das Duas Muralhas`) e um único modo (captura de base).
- Sons gravados, retratos e animações extras (habilidades específicas, 8 direções), progressão durante a
  partida e multiplayer ficam para etapas futuras.
- Controles apenas por teclado e mouse.
