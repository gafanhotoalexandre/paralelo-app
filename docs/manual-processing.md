# Testar processamento manualmente

Os exemplos pequenos normalmente terminam antes dos 150 ms do indicador. Um JSON grande também pode terminar rapidamente, ou atingir outro limite antes do timeout. Este roteiro introduz condições controladas no Worker para permitir observar a interface. Não mede a velocidade real do motor.

O script usa o Playwright já instalado no projeto e abre um Chromium separado. Intercepta somente o Worker nessa sessão; não modifica o código da aplicação nem o conteúdo de `dist/`. O processamento continua local. Nenhuma configuração de teste é incorporada ao build.

## Preparar

No terminal do projeto:

```sh
npm run build
npx playwright install chromium
npm run preview
```

Deixe o preview aberto. Em um segundo terminal, na pasta do projeto, execute um dos comandos abaixo. Feche a janela de teste antes de iniciar outro cenário.

## Processamento lento e bloqueio

```sh
node scripts/manual-processing.mjs slow
```

1. Aguarde o exemplo inicial aparecer comparado. Essa primeira operação usa o motor normalmente.
2. Troque o modo para **Conteúdo** e clique em **Comparar**. A próxima operação ficará cinco segundos ocupando a thread do Worker, depois executará a comparação real.
3. Tente digitar nos editores e acionar comparar, formatar, importar, inverter e limpar: os textos devem permanecer iguais e essas ações devem estar bloqueadas. A página deve continuar respondendo, inclusive à rolagem.
4. O indicador e **Cancelar** devem aparecer após o atraso de 150 ms, sem esperar os cinco segundos. A precisão desses 150 ms é conferida pelo teste automatizado com relógio controlado; a observação visual só confirma o comportamento geral.
5. Aguarde a conclusão: os controles devem ser liberados e o resultado do modo Conteúdo deve aparecer.

Repetir uma comparação que já está atual não inicia uma operação nova. Por isso é necessário mudar o modo ou editar um JSON antes de clicar em Comparar. Formatar ou exportar também consome a próxima operação: siga a sequência acima.

## Cancelamento e recuperação

Reabra o comando `slow`, mude para Conteúdo e clique em Comparar. Durante os cinco segundos, clique em **Cancelar**.

- Deve aparecer a mensagem de operação cancelada.
- Os JSONs devem permanecer intactos e os controles devem ser liberados.
- Clique em Comparar novamente: o Worker será recriado sem a condição controlada e a comparação deve concluir normalmente.

## Timeout e recuperação

```sh
node scripts/manual-processing.mjs timeout
```

Aguarde o resultado inicial, mude para Conteúdo e clique em Comparar. Nessa operação o Worker não enviará resposta.

- Sem cancelar, aguarde aproximadamente dez segundos, mantendo a aba ativa.
- Deve aparecer a mensagem de que a operação ultrapassou dez segundos e foi interrompida.
- Os JSONs devem permanecer intactos e os controles devem ser liberados.
- Clique em Comparar novamente: um Worker novo deve concluir a comparação normalmente.

## Falha e recuperação

```sh
node scripts/manual-processing.mjs failure
```

Aguarde o resultado inicial, mude para Conteúdo e clique em Comparar.

- Deve aparecer a mensagem de que não foi possível concluir o processamento, preservando os JSONs.
- A falha pode ser rápida demais para mostrar o indicador de processamento.
- Clique em Comparar novamente: a operação deve concluir com um Worker novo.

## Encerrar

Feche a janela do Chromium e encerre o preview com Ctrl+C no terminal que o iniciou. Para repetir uma condição, execute novamente o comando correspondente; ela é aplicada apenas à segunda operação do primeiro Worker da sessão.
