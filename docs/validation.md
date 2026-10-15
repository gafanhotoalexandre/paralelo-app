# Validação da bancada visual

## Marco

Prévia React navegável, com resultados demonstrativos. Motor, formatação definitiva, relatório e Worker não implementados.

## Verificações

- TypeScript estrito e build estático de produção.
- 10 testes Vitest: intervalos completos de todos os valores dos exemplos, classificação direcional de null, ausência, modos, interseção de filtros, paginação, revisões e estados reais da página com editor substituído no teste unitário.
- 7 fluxos Playwright com CodeMirror real: responsividade, drawers/foco/localização, filtros e navegação entre páginas, instâncias/seleção/histórico, importação Unicode e falhas sem perda, clipboard/movimento reduzido/isolamento, rolagem/teclado/zoom.
- Larguras de 360, 720, 721, 768, 1.020, 1.021 e 1.440 px; sem rolagem horizontal global nessas larguras.
- Em tablet e celular o inspector ocupa a mesma área dos documentos, sem virar uma seção inferior.
- Drawers esquerdo e direito conferidos com distância inferior a 1 px da borda em desktop; foco contido e restaurado após Escape.
- Seleção de objeto completo, com delimitadores, no editor atualizado; localização bloqueada para valores ausentes e resultados desatualizados.
- Seleção, conexão da instância, desfazer e rolagem preservados ao ocultar/reabrir painéis; expansão e restauração do editor.
- Importação de uma linha com 260.000 emoji, 1.040.002 bytes em UTF-8, mais BOM. Edição, desfazer e cópia completa conferidos. Arquivo maior que 1 MiB e UTF-8 inválido rejeitados, com conteúdo anterior preservado.
- Clipboard disponível e indisponível; contextos separados começam independentes. Sem armazenamento local ou de sessão e sem requisições da aplicação para terceiros no fluxo testado.
- Preferência por movimento reduzido, saída do editor por Tab e navegação das abas por setas.
- Ampliação de 200% por CSS no teste automatizado: sem rolagem horizontal global; ajuda continua acessível. Não substitui uma matriz de zoom nativo em todos os navegadores.

## Capturas

- `screenshots/paralelo-1440.png`: desktop.
- `screenshots/paralelo-768.png`: faixa intermediária.
- `screenshots/paralelo-360.png`: editor no celular.
- `screenshots/paralelo-mobile-results.png`: inspector no celular.
- `screenshots/paralelo-details.png`: drawer de detalhes.

## Limites conhecidos

- Validação automatizada em Chromium; Firefox, WebKit e leitores de tela não foram verificados.
- Os resultados e intervalos pertencem somente aos exemplos intactos. Não há parsing ou comparação de JSON livre.
- Precisão numérica, rejeição de duplicatas, limites completos do resultado e relatório dependem da etapa seguinte, ainda não autorizada.
- Importação tem limite de tamanho; digitação não recebe a validação completa do futuro motor.
- Não há persistência: recarregar a página restaura o exemplo inicial.
- Build passa com aviso de chunk acima de 500 kB; tamanho gzip aproximado de 227 KiB.
