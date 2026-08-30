# Shopee BioLink SaaS — Regras para Agentes

## 1. Documento oficial de contexto

Antes de analisar ou executar uma tarefa, ler:
docs/SHOPEE\_BIOLINK\_CONTEXT.md

Esse documento é a principal fonte de continuidade do projeto.

## 2. Dois modos de trabalho

### MODO ANÁLISE

Quando a tarefa for declarada como MODO ANÁLISE:

- trabalhar somente em leitura;
- não criar arquivos;
- não modificar arquivos;
- não renomear, mover ou excluir arquivos;
- não alterar banco de dados;
- não instalar dependências;
- não executar comandos que modifiquem o projeto;
- não fazer commit ou push.

### MODO EXECUÇÃO

Quando a tarefa for declarada como MODO EXECUÇÃO:

- alterar somente os arquivos explicitamente autorizados no prompt;
- considerar todos os demais arquivos como somente leitura;
- se outro arquivo precisar ser alterado, parar antes da alteração;
- informar o arquivo necessário e o motivo;
- aguardar autorização explícita antes de continuar.

## 3. Escopo fechado

Cada tarefa deve possuir uma lista explícita de arquivos autorizados.

Não realizar alterações fora dessa lista por iniciativa própria.

Não fazer refatorações adicionais, melhorias não solicitadas, limpezas de código ou alterações “aproveitando a oportunidade”.

## 4. Proteção das partes aprovadas

Não alterar a Vitrine 2 ou qualquer funcionalidade já aprovada sem autorização explícita.

Preservar comportamento, layout e funcionalidades existentes que não façam parte da tarefa atual.

## 5. Git

Não executar commit ou push sem autorização explícita.

Não executar reset, clean, checkout destrutivo ou comandos equivalentes por iniciativa própria.

Git é a camada de segurança e auditoria do projeto.

## 6. Validação

Depois de uma alteração:

- executar somente validações compatíveis com a tarefa;
- informar quais testes/comandos foram executados;
- informar erros encontrados;
- não corrigir automaticamente problemas fora do escopo autorizado.

## 7. Auditoria obrigatória

Ao final de toda tarefa em MODO EXECUÇÃO:

- executar `git status --short`;
- executar `git diff --name-only`;
- usar obrigatoriamente `git status --short` para detectar também arquivos novos ainda não rastreados;
- informar todos os arquivos exibidos por qualquer um dos dois comandos;
- confirmar se todos pertencem à lista de arquivos autorizados.

Se aparecer qualquer arquivo não autorizado, parar e informar imediatamente.

## 8. Permissões

Se uma ação exigir permissão adicional não prevista na tarefa, parar e solicitar autorização.

Não assumir que uma permissão ampla está autorizada apenas porque uma permissão menor foi concedida anteriormente.

## 9. Metodologia

Trabalhar uma etapa por vez.

Priorizar alterações pequenas, verificáveis e reversíveis.

Primeiro entender, depois alterar, depois validar.

## 10. Encerramento

Ao concluir uma tarefa, apresentar:

- resumo do que foi feito;
- arquivos modificados;
- validações executadas;
- resultado das validações;
- qualquer risco ou pendência encontrada.
