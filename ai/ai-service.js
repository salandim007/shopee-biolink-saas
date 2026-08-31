'use strict';

const {
    AIProviderError,
    normalizeAIRequest
} = require('./ai-provider');

const {
    createOllamaProvider
} = require('./providers/ollama-provider');


const DEFAULT_AI_PROVIDER =
    'ollama';


class AIService {
    constructor(options = {}) {
        this.getEnvironment =
            options.getEnvironment ||
            (() => process.env);

        this.providerFactories = {
            ollama:
                providerOptions =>
                    createOllamaProvider(
                        providerOptions
                    ),

            ...(options.providerFactories || {})
        };

        this.providerOptions =
            options.providerOptions ||
            {};
    }


    getProviderName() {
        const environment =
            this.getEnvironment();

        return String(
            environment?.AI_PROVIDER ||
            DEFAULT_AI_PROVIDER
        )
            .trim()
            .toLowerCase();
    }


    createProvider(name) {
        const factory =
            this.providerFactories[name];

        if (
            typeof factory !==
            'function'
        ) {
            throw new AIProviderError(
                `Provider de IA não suportado: ${name || 'não informado'}.`,
                'AI_PROVIDER_UNSUPPORTED'
            );
        }

        return factory({
            getEnvironment:
                this.getEnvironment,

            ...this.providerOptions[name]
        });
    }


    async generate(request) {
        const normalizedRequest =
            normalizeAIRequest(
                request
            );

        const providerName =
            this.getProviderName();

        const provider =
            this.createProvider(
                providerName
            );

        return provider.generate(
            normalizedRequest
        );
    }
}


function createAIService(
    options = {}
) {
    return new AIService(
        options
    );
}


const defaultAIService =
    createAIService();


async function generateAI(request) {
    return defaultAIService.generate(
        request
    );
}


module.exports = {
    DEFAULT_AI_PROVIDER,
    AIService,
    createAIService,
    defaultAIService,
    generateAI
};
