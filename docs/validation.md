# Validação da V1 — Paralelo

Execução em 15/10/2026, Windows, Node.js 24 e dependências fixadas pelo package-lock. A interface aprovada passou a usar o motor real; os resultados esperados estáticos existem somente nos testes.

## Resultado

- **112 testes Vitest aprovados**, cobrindo Core, cliente Worker, estados React e exemplos.
- **18 fluxos Playwright aprovados** sobre o build de produção: 16 no Chromium, um fluxo integrado no Firefox e um no WebKit.
- TypeScript estrito e build estático de produção aprovados.
- Aplicação publicada localmente com `npm run preview`, em http://127.0.0.1:5184/.

## Motor e validação estrita

- Igualdade com espaços, ordem de propriedades e strings decodificadas; modos estrutural/conteúdo; qualquer raiz JSON.
- Números grandes equivalentes e distintos, incluindo `9007199254740992` versus `9007199254740993`, decimais, zeros negativos e expoentes positivos/negativos extremos. Comparação usa tokens originais e BigInt para o expoente; não depende do Number produzido pelo jsonc-parser.
- JSON malformado, comentários, vírgulas finais, gramática numérica inválida e espaços não JSON rejeitados.
- Propriedades duplicadas com valores iguais ou distintos, nomes escapados equivalentes, ocorrências aninhadas e nomes como `__proto__`.
- Pares substitutos Unicode válidos; substitutos isolados literais e escapados rejeitados, inclusive em propriedades. Strings decodificadas equivalentes e caracteres multibyte.
- Adições, remoções e tipos; uma diferença por subárvore, sem descendentes repetidos. Arrays vazios, heterogêneos, aninhados e reordenados por índice.
- Todas as direções envolvendo null e ausência, com contagens/classificações esperadas explícitas; comparação nunca afirma quebra contratual comprovada.
- JSON Pointer com nomes vazios, `/` e `~`; homônimos em objetos diferentes; raiz, Unicode/emoji, CRLF e intervalos UTF-16 exatos.
- Ordem determinística, resultados destacados da árvore do parser e imutabilidade dos resultados produzidos pelo Core.
- Profundidade 64 aceita e 65 rejeitada; entrada UTF-8 no limite; 1.000 diferenças aceitas e a seguinte rejeitada.
- Orçamento de textos do resultado: exatamente 4 MiB aceitos; um byte a mais rejeitado sem resultado parcial. Prévia não divide pares substitutos.

## Formatação e relatório

- Formatação semanticamente equivalente e idempotente, com dois espaços/LF, ordem de propriedades/arrays preservada e sequência de tokens não brancos integralmente preservada, incluindo números e escapes.
- Entrada inválida ou saída acima de 1 MiB não retorna texto substituto. Saída exatamente no limite aceita.
- No navegador, falha de formatação com array de 220.000 números preserva o documento e a comparação válida; cópia confirma o conteúdo original.
- Markdown inclui modo, política de arrays, resumo, classificações, todos os caminhos, ausência/null e indicação de prévia truncada.
- Delimitadores maiores que sequências arbitrárias de backticks impedem escapar dos blocos; caminhos/valores com HTML permanecem em blocos.
- Relatório exatamente em 8 MiB aceito; um byte a mais rejeitado sem relatório parcial.
- Download real conferido com inteiros acima de 2^53 e todas as diferenças, mesmo com filtro que oculta parte delas.

## Worker e estados da bancada

- Uma thread nativa, uma operação ativa, revisão/identificação e descarte de respostas antigas; nenhum pool ou fila genérica.
- Testes do cliente: concorrência rejeitada, cancelamento, recriação, resposta antiga, evento tardio de thread antiga, timeout, falhas de construção/execução/deserialização e descarte.
- No navegador: Worker executando trabalho síncrono por cinco segundos, enquanto um frame da interface continua executando. Cancelamento restaura controles e a próxima comparação usa um Worker real novo.
- Timeout testado com relógio controlado; falha real da thread injetada e recuperação verificada. Mensagem da exceção não chega ao feedback da interface.
- Inicialização em React StrictMode e carregamento de exemplo executam uma comparação única. Modo é preservado. Digitação e demais alterações exigem comparação explícita.
- Formatação altera apenas o lado solicitado e invalida o resultado; importação cancelada antes de concluir não sobrescreve documentos posteriores.
- Erros nos dois documentos apresentados por lado; documento original tem prioridade de foco. Resultado anterior desatualizado continua consultável, com exportação/localização bloqueadas.

## Interface real

- Larguras de 360, 720, 721, 768, 1.020, 1.021 e 1.440 px; sem rolagem horizontal global. Inspector ocupa a mesma área dos documentos nas faixas menores.
- Drawers esquerdo/direito com distância inferior a 1 px da borda; foco contido e restaurado após Escape, inclusive após navegação entre páginas.
- Filtros de tipo e classificação por interseção; navegação anterior/próxima cruza a fronteira de 25 itens.
- Instâncias CodeMirror, texto, seleção, histórico/desfazer e rolagem preservados ao ocultar/reabrir painéis, ampliar e redimensionar.
- Localização seleciona o valor completo com delimitadores. Uma subárvore de milhares de linhas, após conteúdo extenso, mostra seu início; realce por linha limitado a 200 linhas.
- Linha Unicode com 260.000 emoji: 1.040.002 bytes, mais BOM na importação. Edição, desfazer, cópia e comparação real/localização conferidos. Arquivo acima de 1 MiB ou UTF-8 inválido preserva o editor.
- Clipboard disponível/indisponível; abas/sessões independentes; sem browser storage e sem requisições a terceiros no fluxo testado.
- Tooltip por hover/foco e Popover por clique/toque na política de arrays. Select estilizado por teclado, sem dropdown nativo. Logo e favicon usam o mesmo arquivo SVG.
- Redução de movimento, saída do editor por Tab e navegação de abas por setas. Ampliação de 200% por CSS sem rolagem horizontal global; não equivale a uma matriz de zoom nativo.
- Contraste calculado para texto principal/secundário, classificações, ação primária e sintaxe. Numeração de linhas/editores ajustada ao tom secundário de contraste maior. Isso não constitui auditoria WCAG completa.

## Capturas

- `screenshots/paralelo-1440.png`: desktop.
- `screenshots/paralelo-768.png`: faixa intermediária.
- `screenshots/paralelo-360.png`: editor no celular.
- `screenshots/paralelo-mobile-results.png`: inspector no celular.
- `screenshots/paralelo-details.png`: drawer de detalhes.

## Limitações da verificação

- A matriz completa roda no Chromium. Firefox/WebKit têm um fluxo integrado; WebKit no Windows não substitui Safari em dispositivos Apple físicos.
- Não foi realizada auditoria manual com leitores de tela, todos os navegadores/dispositivos físicos ou todos os níveis de zoom nativo.
- Tempo limite é de dez segundos e pode ser atingido conforme hardware e entrada, mesmo dentro dos limites de tamanho. O comportamento de falha é controlado; não se promete duração fixa de processamento.
- Vite emite aviso de chunk principal acima de 500 kB; build passa. Aproximadamente 235 KiB gzip no principal e 22 kB sem compressão no Worker.
- Sem persistência; recarregar descarta a bancada e restaura o exemplo. Sem inferência contratual, identidade/movimentação de arrays ou funcionalidades da V2.
- Foi necessário executar navegadores fora do sandbox de subprocessos do ambiente. Nenhuma publicação remota foi realizada.
