# Technos Golf V4 — prévia isolada de marketing

## Objetivo e situação
Produzir uma prévia de 15 segundos, vertical 1080×1920, para revisão antes de postar. A implementação está preparada; a aprovação depende da renderização na VPS, das fotografias reais e da inspeção humana do MP4. Não confundir código concluído com vídeo aprovado.

## Produto e fonte factual
Job: 0551cff8-37a9-4565-9fd2-6423a09da46f.
Shop: 544907177. Item: 11854695020.
Usar exatamente as cinco fotos selecionadas no job da homologação.
Fonte textual: título do catálogo “Relogio Technos Masculino Golf 2115tu/1p Prateado Classic”.
A descrição do vendedor e a autenticidade do produto não foram verificadas neste piloto.
Não alegar resistência à água, material, garantia, preço, desconto ou escassez.

## Direção de marketing
1. Capa: nome Technos Golf e gancho “Estilo em destaque”.
2. Composição split: modelo masculino de estilo clássico.
3. Foto em cartão com moldura e destaque gráfico animado: visual prateado.
4. Composição editorial: identificação 2115TU/1P.
5. Encerramento: conferir na vitrine Mix de Produtos.
Cinco layouts, frases com entrada por palavras, elementos SVG e destaque comercial animados. Fotos completas com object-fit:contain; fundo branco incorporado ao cartão. Sem recorte automático, alteração da forma do produto ou invenção de ângulos.
Paleta azul e verde. A animação ainda precisa de avaliação visual em smartphone.
A ordem das cinco fotos segue a seleção do job e deve ser conferida na revisão humana.

## Arquitetura e dependências
Arquivo: tools/hyperframes-lab/technos_v4.py.
Importa o diretor_ia.py e creative_motion_library.py já instalados em /home/admin/hyperframes-lab/agente-video-piloto.
Reutiliza validação, Kokoro pf_dora 0.85, medição de WAV, cálculo de tempos, obtenção de imagens, render HyperFrames e mixagem existentes.
Este roteiro é editorial explícito; não é uma nova geração Qwen e não altera o prompt ou os pesos do modelo.
Render usa o mesmo HyperFrames instalado (observado 0.8.186), imagem de homologação, um worker, CPU 1 e RAM 2 GB na etapa Docker. TTS reutiliza a instalação do host.
Não instala dependências, reinicia serviços, altera produção, modifica jobs originais ou muda o estado da aprovação deles.
Mantém a dependência de GSAP via CDN já presente no piloto; o acesso precisa funcionar durante o render.
Bloqueio flock impede concorrência entre execuções deste runner. Não bloqueia renderizadores antigos; executar somente uma produção de vídeo por vez.
Sem cron ou postagem automática.

## Execução
Na VPS, no checkout desta branch:
```bash
nice -n 15 timeout 1200 python3 tools/hyperframes-lab/technos_v4.py --render
```
O argumento opcional --job deve apontar para um job do mesmo produto.
Cria pasta única em /home/admin/hyperframes-lab/agente-video-piloto/runs/<data>-technos-v4-<id>/.
Cada execução gera novos áudios, evitando reutilizar os áudios do peitoral.

## Saídas e estados
entrada.json, roteiro-ia.json, proveniencia-v4.json, timing-real.json, composição e assets.
preview-aguarda-aprovacao.mp4, ffprobe.json, revisao/contato-15s.png e quadros em 0.3s, 1s, 2s, entradas de cena e CTA.
STATUS.txt: PROCESSING → AWAITING_APPROVAL ou FAILED.
quality-gate.json: validação técnica separada de aprovação visual/factual; publicação sempre falsa.
A proveniência registra hashes do job, runner e diretor importado.

## Validação e limites
Validação local: sintaxe Python, aceitação do roteiro pelo validador real do piloto, rejeição de produto errado, fotos repetidas e título insuficiente; verificações de sobreposição da voz em três cenários de duração; geração dos cinco layouts e comandos de animação.
Não foi possível executar o render HyperFrames ou inspecionar o layout em navegador neste ambiente. A compatibilidade de execução na VPS e os quadros permanecem pendentes.
Gate técnico: H.264 yuv420p, AAC, 1080×1920 e duração próxima de 15s.
Gate humano: modelo e variante corretos em todas as fotos; fatos sustentados; produto preservado; texto legível sem cortes; narração sincronizada; animações perceptíveis; ausência de barras e sobreposições; CTA compatível com o destino real.
Compare com o MP4 anterior antes de aprovar. O tempo-alvo não autoriza acelerar voz ou cortar falas: se as falas excederem 15s, o piloto falha e o roteiro deve ser encurtado.

## Diagnóstico e continuidade
Se falhar, guardar o caminho impresso e o log; consultar STATUS.txt e ffprobe.json, se existente. O job original fica intacto.
O runner não integra ainda a fila da interface, o coordenador de pausa ou a memória SQLite. São etapas posteriores à aprovação desta prova visual.
Não afirmar publicação ou melhoria de conversão antes de existir evidência.

## Ocorrência e correção em 28/10/2026
A execução 20261028-233250-technos-v4-861e6eac não produziu WAV; posteriormente nenhum processo V4/TTS foi encontrado, mas STATUS.txt permaneceu PROCESSING. A causa de término não foi confirmada; não atribuir automaticamente ao Ollama ou à memória. Havia dois processos de catálogo ativos e nenhuma pausa solicitada.
O runner agora salva tts-01.log a tts-05.log, limita cada subprocesso TTS a 300s e encerra seu próprio grupo de processos em timeout/interrupção. SIGTERM e Ctrl+C passam a registrar FAILED e a causa no STATUS.txt; SIGKILL ou queda da máquina ainda podem deixar estado desatualizado.
Testes adicionais locais exercitaram saída TTS com sucesso, erro, timeout e restauração do executor original. Estes testes usam subprocessos simulados; ainda falta validar o Kokoro real na VPS.
Antes de nova renderização, verificar ajuda da CLI TTS e dependências instaladas e coordenar recursos com o catálogo. O log adicional não corrige por si só a causa da falha TTS.
