# Mix de Produtos — Estúdio Criativo HyperFrames V4

## Diagnóstico do piloto V1–V3
O piloto atual usa layout fixo por cena (`build_html`): foto central, legenda inferior, fundo comum. `direcao_visual` do Qwen não é traduzida em composição. Variações de CSS de zoom não são direção de arte. Cinco testes anteriores validaram o **plano**, não os quadros do MP4. V1–V3 **não aprovadas** para publicação.

## Objetivo
Criar capas e anúncios verticais 1080x1920, 15 s como piloto, com visuais variados por produto, compositing em camadas, tipografia cinética, elementos SVG e gráficos, transições com propósito e resultado auditado quadro a quadro. Não estabelecer quantidade mínima de transições como critério principal; privilegiar clareza e impacto.

## Bibliotecas / padrões oficiais a explorar
Referências: https://hyperframes.app/docs/1-startup/3-examples ; https://hyperframes.app/docs/3-guides/2-prompting ; https://hyperframes.app/docs/3-guides/3-gsap-animation ; https://github.com/heygen-com/hyperframes/blob/main/docs/examples.mdx
- Retrato Vignelli (tipografia hero), Kinetic Type (promos), Product Promo (múltiplas cenas SVG), Play Mode (movimento elástico), Swiss Grid (dados técnicos), Warm Grain (editorial).
- Blocos documentados: hw-title, mk-callout-highlight, mk-specs-list, logo-outro, editorial-flash-overlay, organic-light-leak-overlay, cinematic-zoom.
- Catalogar compatibilidade com **versão efetivamente instalada** antes de executar init/add; não instalar automaticamente.
- Considerar GSAP/CSS/SVG; Three.js/Lottie/shaders apenas após medição de CPU/RAM e teste de renderização isolada.
- GSAP timeline pausada, registro em window.__timelines; anima propriedades visuais, sem assumir playback manual de mídia.

## Produção criativa por produto
1. Insumos: fatos confirmados, fotos reais com orientação e resolução, categoria, identidade Mix de Produtos, destino do clique.
2. Diretor (Qwen): devolve conceito, estilo, *cover_spec*, cena-a-cena com composição, hierarquia tipográfica, elementos SVG, motion curves, animação de palavras, transições, justificativa vinculada ao produto e fatos citados.
3. Validador factual: sem alegações não sustentadas, sem preço/desconto desatualizado, sem distorcer produto, e sem inventar ângulos inexistentes.
4. **Capa**: produzir 2 a 3 variações por produto para revisão: hero-product, kinetic-headline, premium-editorial; gancho até 2s, contraste e legibilidade em smartphone, área segura.
5. **Cenas**: biblioteca de padrões configuráveis, não um template obrigatório. Intro hero, product focus, detalhe com callout, split layout, especificações animadas, comparações apenas com dados verificáveis, CTA.
6. Texto/narração: o campo fala_legenda é a mesma frase sintetizada; Kokoro pf_dora pt-br 0.85; timings a partir de WAV, pausas sem cortar.
7. Composição: layers diferentes por cena, transições variadas pertinentes ao ritmo; recorte de produto somente após avaliação das bordas. Fotos com fundo branco devem permitir opção de composição que o incorpore, nunca remoção automática descuidada.
8. Renderização: homologação/lab isolado, uma job por vez, não interromper catálogo sem coordenação; output versionado, revisão humana obrigatória, publicar=false.
9. Controle de qualidade: capturar frames em 0.3s, 1s, 2s, limites de cenas, CTA; testar presença do produto, ausência de barras pretas, não clipping e legibilidade; ffprobe para codec, duração, áudio. Métricas objetivas + avaliação visual humana.
10. Memória SQLite persistente isolada: video_jobs, video_reviews, creative_rules, creative_memories e quality_gate, com versões, decisões e evidências. Não presumir retreinamento dos pesos Qwen.

## Aceitação da primeira entrega V4
- Pelo menos uma capa **realmente diferente** das V2/V3, com título animado e hierarquia clara.
- Pelo menos dois layouts distintos no mesmo vídeo e um callout animado (não apenas zoom).
- Um elemento gráfico vetorial com animação perceptível.
- Voz Dora sincronizada, frases verificadas, sem mudança de forma/cor do produto.
- Comparativo de frames e avaliação explícita; caso falhe, não marcar como concluído.
- Não modificar código de produção ou containers; não usar `git add .`; backups fora do Git.

## Primeiro passo seguro
Inventariar, em modo leitura, a versão e os exemplos do HyperFrames **já instalados** no laboratório. Depois selecionar um exemplo de referência para fazer a capa V4 em pasta nova, sem sobrescrever V1–V3. Não afirmar que o recurso atual já está implantado até validar frames.
