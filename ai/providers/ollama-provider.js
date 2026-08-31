'use strict';

const {
    AIProvider,
    AIProviderError,
    normalizeAIRequest,
    normalizeAIResponse
} = require('../ai-provider');


const DEFAULT_OLLAMA_BASE_URL =
    'http://127.0.0.1:11434';

const DEFAULT_TIMEOUT_MS =
    30000;


function normalizeBaseUrl(value) {
    const candidate =
        String(
            value ||
            DEFAULT_OLLAMA_BASE_URL
        ).trim();

    let parsedUrl;

    try {
        parsedUrl =
            new URL(candidate);
    } catch {
        throw new AIProviderError(
            'OLLAMA_BASE_URL inválida.',
            'AI_INVALID_CONFIGURATION'
        );
    }

    if (
        parsedUrl.protocol !== 'http:' &&
        parsedUrl.protocol !== 'https:'
    ) {
        throw new AIProviderError(
            'OLLAMA_BASE_URL deve usar http: ou https:.',
            'AI_INVALID_CONFIGURATION'
        );
    }

    return candidate.replace(
        /\/+$/,
        ''
    );
}


function normalizeTimeout(value) {
    if (
        value === undefined ||
        value === null ||
        value === ''
    ) {
        return DEFAULT_TIMEOUT_MS;
    }

    const timeoutMs =
        Number(value);

    if (
        !Number.isInteger(timeoutMs) ||
        timeoutMs < 1
    ) {
        throw new AIProviderError(
            'Timeout de IA inválido.',
            'AI_INVALID_REQUEST'
        );
    }

    return timeoutMs;
}


class OllamaProvider extends AIProvider {
    constructor(options = {}) {
        super();

        this.getEnvironment =
            options.getEnvironment ||
            (() => process.env);

        this.fetchImplementation =
            options.fetchImplementation ||
            globalThis.fetch;

        this.defaultTimeoutMs =
            options.timeoutMs ||
            DEFAULT_TIMEOUT_MS;
    }


    getName() {
        return 'ollama';
    }


    getConfiguration() {
        const environment =
            this.getEnvironment();

        const model =
            String(
                environment
                    ?.OLLAMA_MODEL ||
                ''
            ).trim();

        if (!model) {
            throw new AIProviderError(
                'OLLAMA_MODEL não está configurado.',
                'AI_INVALID_CONFIGURATION'
            );
        }

        return {
            baseUrl:
                normalizeBaseUrl(
                    environment
                        ?.OLLAMA_BASE_URL
                ),

            model
        };
    }


    async generate(request) {
        const normalizedRequest =
            normalizeAIRequest(
                request
            );

        const {
            baseUrl,
            model
        } = this.getConfiguration();

        if (
            typeof this.fetchImplementation !==
            'function'
        ) {
            throw new AIProviderError(
                'Fetch nativo não está disponível.',
                'AI_RUNTIME_UNSUPPORTED'
            );
        }

        const {
            timeoutMs:
                requestedTimeout,
            ...modelOptions
        } = normalizedRequest.options;

        const timeoutMs =
            normalizeTimeout(
                requestedTimeout ??
                this.defaultTimeoutMs
            );

        const systemParts = [
            normalizedRequest.system,
            normalizedRequest.instructions
        ].filter(Boolean);

        const messages = [];

        if (systemParts.length > 0) {
            messages.push({
                role: 'system',
                content:
                    systemParts.join(
                        '\n\n'
                    )
            });
        }

        messages.push({
            role: 'user',
            content:
                normalizedRequest.prompt
        });

        const payload = {
            model,
            messages,
            stream: false
        };

        if (
            normalizedRequest.format !==
            null
        ) {
            payload.format =
                normalizedRequest.format;
        }

        if (
            Object.keys(modelOptions)
                .length > 0
        ) {
            payload.options =
                modelOptions;
        }

        const controller =
            new AbortController();

        const timeout =
            setTimeout(
                () => controller.abort(),
                timeoutMs
            );

        let response;

        try {
            response =
                await this.fetchImplementation(
                    `${baseUrl}/api/chat`,
                    {
                        method: 'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body:
                            JSON.stringify(
                                payload
                            ),

                        signal:
                            controller.signal
                    }
                );
        } catch (error) {
            if (
                error?.name ===
                'AbortError'
            ) {
                throw new AIProviderError(
                    'O provedor de IA excedeu o tempo limite.',
                    'AI_TIMEOUT',
                    { cause: error }
                );
            }

            throw new AIProviderError(
                'O provedor de IA está indisponível.',
                'AI_PROVIDER_UNAVAILABLE',
                { cause: error }
            );
        } finally {
            clearTimeout(timeout);
        }

        if (!response.ok) {
            throw new AIProviderError(
                `O provedor de IA retornou HTTP ${response.status}.`,
                'AI_PROVIDER_HTTP_ERROR',
                {
                    statusCode:
                        response.status
                }
            );
        }

        let data;

        try {
            data =
                await response.json();
        } catch (error) {
            throw new AIProviderError(
                'O provedor de IA retornou uma resposta inválida.',
                'AI_INVALID_RESPONSE',
                { cause: error }
            );
        }

        const content =
            data?.message?.content;

        if (
            typeof content !== 'string' ||
            !content.trim()
        ) {
            throw new AIProviderError(
                'O provedor de IA retornou conteúdo inválido.',
                'AI_INVALID_RESPONSE'
            );
        }

        return normalizeAIResponse({
            provider:
                this.getName(),

            model,
            content,

            metadata: {
                done:
                    data.done === true,

                doneReason:
                    data.done_reason ||
                    null,

                totalDuration:
                    data.total_duration ||
                    null
            }
        });
    }
}


function createOllamaProvider(
    options = {}
) {
    return new OllamaProvider(
        options
    );
}


module.exports = {
    DEFAULT_OLLAMA_BASE_URL,
    DEFAULT_TIMEOUT_MS,
    normalizeBaseUrl,
    OllamaProvider,
    createOllamaProvider
};
