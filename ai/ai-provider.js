'use strict';


class AIProviderError extends Error {
    constructor(
        message,
        code = 'AI_PROVIDER_ERROR',
        options = {}
    ) {
        super(message);

        this.name = 'AIProviderError';
        this.code = code;

        if (options.cause) {
            this.cause = options.cause;
        }

        if (options.statusCode) {
            this.statusCode =
                options.statusCode;
        }
    }
}


function normalizeText(
    value,
    field,
    required = false
) {
    if (
        value === undefined ||
        value === null
    ) {
        if (required) {
            throw new AIProviderError(
                `${field} é obrigatório.`,
                'AI_INVALID_REQUEST'
            );
        }

        return null;
    }

    const text =
        String(value).trim();

    if (
        required &&
        !text
    ) {
        throw new AIProviderError(
            `${field} é obrigatório.`,
            'AI_INVALID_REQUEST'
        );
    }

    return text || null;
}


function normalizeAIRequest(
    request = {}
) {
    if (
        !request ||
        typeof request !== 'object' ||
        Array.isArray(request)
    ) {
        throw new AIProviderError(
            'Requisição de IA inválida.',
            'AI_INVALID_REQUEST'
        );
    }

    const options =
        request.options === undefined ||
        request.options === null
            ? {}
            : request.options;

    if (
        typeof options !== 'object' ||
        Array.isArray(options)
    ) {
        throw new AIProviderError(
            'options deve ser um objeto.',
            'AI_INVALID_REQUEST'
        );
    }

    const format =
        request.format ??
        null;

    if (
        format !== null &&
        typeof format !== 'string' &&
        (
            typeof format !== 'object' ||
            Array.isArray(format)
        )
    ) {
        throw new AIProviderError(
            'format deve ser texto, objeto ou null.',
            'AI_INVALID_REQUEST'
        );
    }

    return {
        system:
            normalizeText(
                request.system,
                'system'
            ),

        instructions:
            normalizeText(
                request.instructions,
                'instructions'
            ),

        prompt:
            normalizeText(
                request.prompt,
                'prompt',
                true
            ),

        format,
        options: {
            ...options
        }
    };
}


function normalizeAIResponse({
    provider,
    model,
    content,
    metadata = {}
} = {}) {
    const normalizedContent =
        normalizeText(
            content,
            'content',
            true
        );

    return {
        provider:
            normalizeText(
                provider,
                'provider',
                true
            ),

        model:
            normalizeText(
                model,
                'model',
                true
            ),

        content:
            normalizedContent,

        metadata:
            metadata &&
            typeof metadata === 'object' &&
            !Array.isArray(metadata)
                ? { ...metadata }
                : {}
    };
}


class AIProvider {
    getName() {
        throw new AIProviderError(
            'Provider deve implementar getName().',
            'AI_PROVIDER_NOT_IMPLEMENTED'
        );
    }


    async generate() {
        throw new AIProviderError(
            'Provider deve implementar generate().',
            'AI_PROVIDER_NOT_IMPLEMENTED'
        );
    }
}


module.exports = {
    AIProvider,
    AIProviderError,
    normalizeAIRequest,
    normalizeAIResponse
};
