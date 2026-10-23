# Mix de Produtos — Diretor Criativo IA

**Registro de continuidade — 23/10/2026**
**Repositório:** `salandim007/shopee-biolink-saas`
**Branch de trabalho:** `feature/facebook-reels-multicanal`
**Status:** protótipo técnico funcional; qualidade criativa ainda não aprovada para produção comercial.

## 1. Visão e regra de produto

O Mix de Produtos deve transformar informações *reais* do catálogo Shopee em propagandas curtas e únicas, usando um Diretor Criativo por IA. A IA escreve conceito, capa, falas/legendas, cenas, transições e CTA; o software executa a renderização. O operador avalia e aprova a prévia antes de qualquer publicação.

**Não transformar o sistema em um conjunto de vídeos visualmente iguais.** Cada produto terá linguagem e direção visual próprias, reaproveitando regras de qualidade e o histórico de aprendizado.

## 2. Ferramentas e infraestrutura confirmadas

- **VPS Contabo**, Ubuntu, Docker, repositório na VPS: `/opt/shopee-biolink-saas`.
- **Ollama**: `qwen3.5:4b` para textos do catálogo e atualmente também para planejamento do vídeo. `qwen3.5:0.8b` está instalado, mas falhou na validação de cinco cenas durante os testes, por isso não deve ser assumido como modelo criativo de produção.
- **Kokoro ONNX** via ambiente Python isolado: `/home/admin/hyperframes-lab/tts-venv`. Voz aprovada: `pf_dora`, idioma `pt-br`, velocidade `0.85`.
- **HyperFrames** instalado no laboratório `/home/admin/hyperframes-lab`, usado para renderizar vídeo vertical. FFmpeg disponível em imagem Docker de homologação.
- **SaaS principal** em `shopee-biolink`; homologação em `shopee-biolink-hml`. Preservar serviços e dados da produção.

## 3. Fluxo do laboratório já testado

1. O processo `ai/run-nightly-post-texts.js` termina um produto e grava os dados antes de reconhecer a pausa.
2. O coordenador solicita pausa usando arquivos em `/app/data/ai/video-coordinator` (montagem persistente de `/opt/shopee-biolink-saas/data/ai`).
3. Após confirmação de pausa, o Diretor Criativo usa o Qwen para criar plano de propaganda a partir de dados do produto.
4. Um validador exige conceito, paleta, estilo e **cinco cenas**: capa, três benefícios e CTA; informações factuais devem vir dos dados do produto.
5. Kokoro produz narração e HyperFrames renderiza a composição; FFmpeg posiciona as falas nos tempos de legenda.
6. Gera **prévia para aprovação humana**, sem publicação automática.
7. O pedido de pausa é liberado mesmo quando uma etapa falha; o catálogo pode retomar.

A recuperação automática do catálogo foi observada após erros de validação e de timeout. Uma prévia foi gerada com sucesso e o catálogo foi liberado em seguida. Isso valida o **fluxo técnico inicial**, não a qualidade publicitária.

## 4. Código, caminhos e versionamento

- Arquivo do catálogo versionado no repositório: `ai/run-nightly-post-texts.js`.
  - Marcador da alteração: `MIX_PAUSA_COOPERATIVA_V1`.
  - A espera pela liberação é chamada **entre produtos**, após completar a execução anterior.
  - Na comparação Git de 23/10/2026, o único arquivo rastreado modificado era este; `git diff --check` não acusou falhas.
- Código do laboratório **fora do repositório**, precisa ser versionado explicitamente:
  - `/home/admin/hyperframes-lab/agente-video-piloto/diretor_ia.py`
  - `/home/admin/hyperframes-lab/coordenador-ias-mix.py`
  - `/home/admin/hyperframes-lab/alternancia-ias-mix-v2.py` (migração histórica; não é serviço contínuo)
- Arquivos de entrada e instruções do agente no laboratório:
  - `/home/admin/hyperframes-lab/agente-video-piloto/ENTRADA_TESTE_PEITORAL.json`
  - `/home/admin/hyperframes-lab/agente-video-piloto/INSTRUCOES_AGENTE_VIDEO.md`
- Exemplo de vídeo do piloto:
  - `/home/admin/hyperframes-lab/agente-video-piloto/runs/20261023-193526-23693566603/preview-aguarda-aprovacao.mp4`
- **Não adicionar ao Git** pastas `data/backups/`, `data/ai/`, backups do laboratório, tokens, credenciais, dados reais de sessão, saídas MP4 grandes ou arquivos temporários. Antes de versionar scripts, revisá-los para segredos e dependências hardcoded.
- O diretório do código na imagem Docker (`/app/ai`) **não está montado do host**. Alterações no arquivo da VPS não mudam sozinhas o processo carregado no container. Planejar a implantação de forma explícita e segura; evitar reiniciar produção sem necessidade.

## 5. Dificuldades reais descobertas

- A execução do catálogo iniciada antes de implementar a pausa **não podia ser pausada cooperativamente**. Foi necessário um procedimento de migração pontual para substituí-la.
- O primeiro encerramento do processo antigo falhou por falta de permissão no host; correção posterior sinalizou o processo de dentro do Docker.
- O Diretor Criativo com `qwen3.5:0.8b` gerou resultados inválidos/incompletos (cinco cenas) e teve timeout. A solução testada foi utilizar `qwen3.5:4b` **durante a pausa controlada do catálogo** e respostas com esquema de validação.
- O roteiro chegou a falhar por tipo inesperado no campo `midia_referencia` (`list` em vez de string); o validador foi protegido contra entrada malformada.
- O usuário estabeleceu como **meta de desempenho** planejar o vídeo em até 120 segundos. Não presumir que esse limite já esteja implantado: confirmar em código antes de prometer SLA. Renderização e TTS têm tempos próprios.
- Prévia piloto de 15 segundos tecnicamente concluída **não aprovada como propaganda**: produto demasiadamente estático, pouca variedade visual, capa sem impacto e CTA genérico. Não tratar o MP4 existente como template criativo definitivo.

## 6. Padrão de vídeo aprovado como objetivo

- Vídeo individual, não cópia do último vídeo.
- **Capa/apresentação curta** do produto com gancho visual e comercial.
- **No mínimo 3 transições visuais perceptíveis**, escolhidas de uma biblioteca de efeitos aprovada (e não aplicadas artificialmente apenas para cumprir contagem).
- Mudança real de enquadramento/composição, quando houver meios visuais suficientes. Evitar alongamento, barras pretas e distorção da foto original.
- Narração com **Kokoro pf_dora / pt-br / 0.85**, tom suave e comercial, com pausas naturais.
- **O texto falado corresponde exatamente ao texto da legenda mostrada**; controlar timing e duração efetiva por clipe de áudio, sem frases paralelas diferentes.
- Utilizar somente informações comprovadas pelo catálogo/fonte do produto. Não inventar benefícios, características, avaliações ou descontos.
- Encerramento com CTA útil e identidade **Mix de Produtos**, com destino de compra adequado ao canal.
- Nunca publicar automaticamente; exigir **aprovação explícita**.

## 7. Próxima prioridade: Memória Criativa (aprendizado cumulativo)

**Aprendizado pretendido:** memória externa persistente + feedback + avaliações + recuperação de exemplos. Não afirmar que os pesos do Qwen são atualizados automaticamente a cada vídeo.

Criar componentes separados:

1. `video_jobs`: ID do produto, imagens de origem, roteiro, parâmetros de voz, storyboard, versão, caminho da renderização, tempos e status.
2. `video_reviews`: avaliação do usuário, notas e motivos por dimensão (capa, ritmo, transições, voz, sincronização, CTA, precisão).
3. `creative_rules`: regras estáveis e verificáveis — por exemplo, `min_transitions=3`, `voice=pf_dora`, `speed=0.85`, `speech_equals_caption=true`.
4. `creative_memories`: exemplos positivos/negativos com tags de categoria/estilo, descrição do erro e melhoria decidida; disponibilizar ao Qwen como contexto antes de criar o próximo roteiro.
5. `quality_gate`: validar roteiro e mídia renderizada; replanejar somente etapas reprovadas, com limite de tentativas e orçamento de processamento.
6. Futuramente associar resultados reais por publicação (cliques, pedidos, vendas, comissão) sem confundir correlação com causalidade.

**Fluxo desejado:** produto → memória relevante → Qwen cria plano → validação → TTS e renderização → verificação de quadros/áudio → prévia → avaliação do usuário → grava memória → próxima versão.

## 8. Regras de engenharia e operação

- Fazer **um passo por vez** no terminal e explicar alterações críticas.
- Alterações pequenas pelo VS Code/SSH; arquivos grandes podem ser enviados por `scp`.
- Código e documentação no Git, nunca `git add .` sem revisão. Ignorar backups e dados runtime.
- Salvar progresso e proteger a produção antes de pausar ou migrar tarefas. Garantir `finally`/retomada também em falha e timeout.
- Impedir jobs concorrentes duplicados e impor limites de tempo e RAM/CPU.
- Priorizar qualidade comercial com fact-check e revisão humana, não apenas “renderizou, então está aprovado”.

## 9. Contexto do próximo chat

**Título sugerido:** `Mix de Produtos — Diretor Criativo IA | Memória e Aprendizado Contínuo`.

**Próxima execução:** revisar e versionar scripts de laboratório com segurança; implantar primeiro esquema da Memória Criativa; registrar avaliação da prévia atual como `REPROVADO` com motivos objetivos; passar regras de voz e transições ao validador/renderizador; produzir uma nova versão para avaliação. **Não voltar a diagnosticar funções já comprovadas** sem erro novo.
