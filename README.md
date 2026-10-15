# Paralelo

Bancada para comparar documentos JSON. Esta entrega é a **prévia navegável da interface React**, aguardando aprovação visual antes da implementação do motor.

![Bancada em desktop](docs/screenshots/paralelo-1440.png)

## Executar

Requer Node.js 24 LTS e npm. Na raiz:

```sh
npm ci
npm run dev
```

Abra http://127.0.0.1:5184/. A porta é fixa para evitar abrir outra aplicação por engano.

Para executar o artefato estático:

```sh
npm run build
npm run preview
```

A saída está em `dist/`, ignorada no Git. A publicação remota não faz parte deste marco.

## O que experimentar

- Os exemplos de cadastro, webhook e configuração substituem os documentos e apresentam resultados demonstrativos no modo selecionado.
- Alterar o modo exige clicar em **Comparar**. O botão reapresenta apenas o cenário demonstrativo intacto; não compara documentos livres.
- O modo **Conteúdo** do exemplo de configuração tem 32 diferenças e permite testar as duas páginas.
- Filtros de classificação e tipo se combinam. O drawer de detalhes navega pelo conjunto filtrado, inclusive entre páginas.
- **Localizar** seleciona o valor completo no CodeMirror a partir de intervalos fixos conferidos para cada exemplo. Ausência e JSON `null` são distintos.
- Os editores permitem digitar, desfazer/refazer, importar UTF-8 com ou sem BOM, copiar e ampliar. Tab permite sair do editor.
- Editar, importar, inverter ou mudar o modo torna o resultado anterior desatualizado e bloqueia sua localização. Recarregar um exemplo restaura o cenário.
- Textos, seleção, histórico e rolagem permanecem nas mesmas instâncias de editor ao alternar abas ou larguras.

Formatação e exportação estão desabilitadas e identificadas como pendentes. Esta prévia **não valida JSON livre nem comprova precisão de comparação numérica**. Essas garantias dependerão dos testes e da implementação do motor após a aprovação.

## Interface

A POC original, preservada em `reference/api-diff-poc.html`, orienta composição, cores e interações. Seu algoritmo não foi transportado.

| Largura | Organização |
|---|---|
| A partir de 1.021 px | Dois documentos e inspector lateral |
| 721–1.020 px | Abas Documentos / Diferenças |
| Até 720 px | Abas Original / Atualizado / Diferenças |

Drawers usam shadcn/ui sobre Radix, com contenção e restauração de foco, Escape e ancoragem nas bordas. Transições têm entre 150 e 170 ms e respeitam a preferência por movimento reduzido. As fontes DM Sans e IBM Plex Mono são locais, com licenças em `public/fonts/`.

## Testar

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Vitest cobre os dados demonstrativos e os estados da bancada. Playwright verifica a aplicação de produção com CodeMirror real. Os testes de navegador reutilizam o preview local da porta 5184 ou o iniciam quando necessário; execute o build antes deles. Capturas são atualizadas em `docs/screenshots/`.

Cenários e limites efetivamente verificados estão em [docs/validation.md](docs/validation.md). Testes do motor definitivo permanecem fora deste marco.

## Código

React 19, TypeScript estrito, Vite, Tailwind 4, CodeMirror 6, Lucide e componentes shadcn seletivos sobre Radix. Versões fixas e um lockfile npm.

- `src/app`: composição e estado local da bancada.
- `src/components`: editores, inspector e componentes visuais.
- `src/demo`: textos, diferenças e intervalos **autoriais e fixos**; não contém um comparador.
- `tests/e2e`: cenários reais de navegador.

Não há backend, Worker, armazenamento de documentos ou estado global externo. A aplicação publicada usa arquivos estáticos; o WebSocket de HMR existe apenas no servidor de desenvolvimento do Vite.

## Privacidade e limites desta prévia

Os documentos ficam em memória neste navegador. Não há localStorage, sessionStorage, cookies, histórico, telemetria ou envio de payloads. A importação limita cada arquivo a 1 MiB e rejeita UTF-8 inválido, preservando o editor em caso de falha. Esse limite de importação não substitui a futura validação de documentos digitados.

Clipboard depende do navegador e do contexto seguro. Quando indisponível, a interface informa a falha e permite cópia manual. A suíte de navegador foi executada em Chromium; outros motores ainda não foram validados.

O bundle principal desta prévia tem aproximadamente 227 KiB comprimidos com gzip. Vite emite um aviso pelo tamanho não comprimido acima de 500 kB; não há falha de build. Otimização adicional de carregamento não foi incluída neste marco visual.

## Preservação da implementação anterior

- `archive/dotnet-v1`: estado completo do workspace .NET, commit `36ed3ee`.
- `archive/dotnet-rar`: os 41 arquivos não gerados do RAR original, commit `cf55343`, com origem documentada em `ARCHIVE.md` nessa branch.
- `main`: aplicação React ativa; sem dependência do código .NET.

A comparação do RAR encontrou 29 arquivos idênticos ao workspace e 12 diferentes, sem arquivos ausentes. Seu snapshot foi conferido byte a byte; arquivos gerados e redundantes foram excluídos. O RAR local continua intacto e ignorado.

Para consultar os registros sem trocar a branch ativa:

```sh
git log --oneline archive/dotnet-v1
git show archive/dotnet-rar:ARCHIVE.md
```

Para exportar uma cópia recuperável:

```sh
git archive --format=zip --output=dotnet-v1.zip archive/dotnet-v1
```

As branches são preservação local no mesmo repositório; não substituem um backup externo. Não há remoto configurado ou publicação realizada.

## Ponto de aprovação

**Parar após esta bancada navegável.** A implementação completa do motor, sua integração e o Worker exigem aprovação posterior explícita do usuário.
