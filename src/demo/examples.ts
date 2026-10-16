export interface ExampleDocument {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly letter: string;
  readonly before: string;
  readonly after: string;
}
// Only documents and metadata ship to the application. Results always come from the engine.
export const examples: readonly ExampleDocument[] = [
  {
    id: "cadastro",
    title: "Cadastro de cliente",
    subtitle: "Campos, tipos e valores null.",
    letter: "01",
    before:
      '{\n  "id": 42,\n  "nome": "Marina Exemplo",\n  "email": "marina@example.com",\n  "cpf": "000.000.000-00",\n  "ativo": true,\n  "apelido": null,\n  "telefone": "(00) 00000-0000",\n  "endereco": {\n    "cidade": "Cidade Exemplo",\n    "uf": "SP"\n  },\n  "itens": [\n    {\n      "sku": "DEMO-01",\n      "quantidade": 2\n    },\n    {\n      "sku": "DEMO-02",\n      "quantidade": 1\n    }\n  ]\n}',
    after:
      '{\n  "id": 42,\n  "nome": "Marina de Exemplo",\n  "email": "marina@example.com",\n  "documento": {\n    "tipo": "CPF",\n    "numero": "000.000.000-00"\n  },\n  "ativo": "sim",\n  "apelido": "Mari",\n  "telefone": null,\n  "endereco": {\n    "cidade": "Cidade Exemplo",\n    "uf": "SP"\n  },\n  "itens": [\n    {\n      "sku": "DEMO-01",\n      "quantidade": 3\n    },\n    {\n      "sku": "DEMO-02",\n      "quantidade": 1\n    }\n  ]\n}',
  },
  {
    id: "webhook",
    title: "Evento de webhook",
    subtitle: "Payload de integração com tipo alterado e novos campos.",
    letter: "02",
    before:
      '{\n  "evento": "pedido.criado",\n  "versao": 1,\n  "pedido": {\n    "id": "PED-DEMO-1042",\n    "total": 149.9,\n    "moeda": "BRL"\n  },\n  "tentativa": 1,\n  "assinatura": "demonstracao",\n  "callback": null\n}',
    after:
      '{\n  "evento": "pedido.atualizado",\n  "versao": 2,\n  "pedido": {\n    "id": "PED-DEMO-1042",\n    "total": "149.90",\n    "moeda": "BRL",\n    "status": "confirmado"\n  },\n  "tentativa": 2,\n  "callback": "https://example.com/webhook",\n  "rastreio": {\n    "origem": "sandbox"\n  }\n}',
  },
  {
    id: "configuracao",
    title: "Configuração de serviço",
    subtitle: "Opções e recursos; experimente a paginação no modo Conteúdo.",
    letter: "03",
    before:
      '{\n  "ambiente": "sandbox",\n  "timeout": 3000,\n  "legado": true,\n  "recursos": {\n    "recurso_01": false,\n    "recurso_02": false,\n    "recurso_03": false,\n    "recurso_04": false,\n    "recurso_05": false,\n    "recurso_06": false,\n    "recurso_07": false,\n    "recurso_08": false,\n    "recurso_09": false,\n    "recurso_10": false,\n    "recurso_11": false,\n    "recurso_12": false,\n    "recurso_13": false,\n    "recurso_14": false,\n    "recurso_15": false,\n    "recurso_16": false,\n    "recurso_17": false,\n    "recurso_18": false,\n    "recurso_19": false,\n    "recurso_20": false,\n    "recurso_21": false,\n    "recurso_22": false,\n    "recurso_23": false,\n    "recurso_24": false,\n    "recurso_25": false,\n    "recurso_26": false,\n    "recurso_27": false,\n    "recurso_28": false\n  }\n}',
    after:
      '{\n  "ambiente": "demonstracao",\n  "timeout": "5s",\n  "observabilidade": true,\n  "recursos": {\n    "recurso_01": true,\n    "recurso_02": true,\n    "recurso_03": true,\n    "recurso_04": true,\n    "recurso_05": true,\n    "recurso_06": true,\n    "recurso_07": true,\n    "recurso_08": true,\n    "recurso_09": true,\n    "recurso_10": true,\n    "recurso_11": true,\n    "recurso_12": true,\n    "recurso_13": true,\n    "recurso_14": true,\n    "recurso_15": true,\n    "recurso_16": true,\n    "recurso_17": true,\n    "recurso_18": true,\n    "recurso_19": true,\n    "recurso_20": true,\n    "recurso_21": true,\n    "recurso_22": true,\n    "recurso_23": true,\n    "recurso_24": true,\n    "recurso_25": true,\n    "recurso_26": true,\n    "recurso_27": true,\n    "recurso_28": true\n  }\n}',
  },
];
export const initialExample = examples[0]!;
