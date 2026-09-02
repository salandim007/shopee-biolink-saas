'use strict';

const {
    projectProductEvidence
} = require('./instagram-content-creator');


/*
 * Mantidos por compatibilidade com o restante do projeto.
 * O auditor atual é determinístico e não chama IA.
 */
const AUDIT_FORMAT =
    Object.freeze({
        type: 'object',
        properties: {
            claims: {
                type: 'array'
            }
        },
        required: ['claims'],
        additionalProperties: false
    });


const SYSTEM_INSTRUCTIONS =
    'Auditoria determinística baseada exclusivamente nas evidências do produto.';


function normalizeText(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/(\d),(\d)/g, '$1.$2')
        .replace(/[^a-z0-9%]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}


function canonicalNumber(value) {
    const normalized =
        String(value ?? '')
            .trim()
            .replace(',', '.');

    const numeric =
        Number(normalized);

    return Number.isFinite(numeric)
        ? String(numeric)
        : normalized;
}


function extractNumbers(value) {
    const matches =
        String(value ?? '')
            .match(/\d+(?:[.,]\d+)?/g) ||
        [];

    return matches
        .map(canonicalNumber)
        .filter(Boolean);
}


function meaningfulWords(value) {
    const ignored =
        new Set([
            'para',
            'com',
            'sem',
            'uma',
            'uns',
            'das',
            'dos',
            'por',
            'que',
            'produto'
        ]);

    return normalizeText(value)
        .split(' ')
        .filter(word =>
            word.length >= 3 &&
            !ignored.has(word)
        );
}


function projectEvidenceFields(
    evidence
) {
    const projection =
        projectProductEvidence(evidence);

    const fields = {};

    function visit(value, prefix) {
        if (
            value === null ||
            value === undefined ||
            value === ''
        ) {
            return;
        }

        if (
            typeof value !== 'object'
        ) {
            fields[prefix] =
                String(value);

            return;
        }

        for (
            const [key, child]
            of Object.entries(value)
        ) {
            visit(
                child,
                prefix
                    ? `${prefix}.${key}`
                    : key
            );
        }
    }

    visit(projection, '');

    return fields;
}


function flattenEvidence(evidence) {
    return projectEvidenceFields(
        evidence
    );
}


function verifyCitation(
    citation,
    evidenceFields
) {
    const field =
        citation?.field;

    const quote =
        typeof citation?.quote ===
            'string'
            ? citation.quote.trim()
            : '';

    return Boolean(
        field &&
        quote &&
        evidenceFields[field] &&
        String(
            evidenceFields[field]
        ).includes(quote)
    );
}


function findSupportingEvidence(
    claim,
    evidenceFields
) {
    const claimText =
        normalizeText(claim);

    const claimNumbers =
        new Set(
            extractNumbers(claim)
        );

    const claimWords =
        new Set(
            meaningfulWords(claim)
        );

    const evidence = [];

    for (
        const [field, rawValue]
        of Object.entries(
            evidenceFields
        )
    ) {
        const valueText =
            normalizeText(rawValue);

        if (!valueText) {
            continue;
        }

        const valueNumbers =
            extractNumbers(rawValue);

        let supported =
            valueNumbers.some(
                number =>
                    claimNumbers.has(number)
            );

        if (
            !supported &&
            valueText.length >= 4 &&
            (
                claimText.includes(
                    valueText
                ) ||
                (
                    claimText.length >= 6 &&
                    valueText.includes(
                        claimText
                    )
                )
            )
        ) {
            supported = true;
        }

        if (
            !supported &&
            (
                field === 'name' ||
                field === 'category'
            )
        ) {
            const evidenceWords =
                meaningfulWords(
                    rawValue
                );

            const matchedWords =
                evidenceWords.filter(
                    word =>
                        claimWords.has(word)
                );

            const strongSingleWord =
                matchedWords.length === 1 &&
                matchedWords[0]
                    .length >= 5 &&
                claimWords.size <= 4;

            const usefulOverlap =
                matchedWords.length >= 2;

            if (
                strongSingleWord ||
                usefulOverlap
            ) {
                supported = true;
            }
        }

        if (supported) {
            evidence.push({
                field,
                quote:
                    String(rawValue)
            });
        }
    }

    return evidence;
}


function getAllEvidenceNumbers(
    evidenceFields
) {
    const numbers =
        new Set();

    for (
        const value
        of Object.values(
            evidenceFields
        )
    ) {
        for (
            const number
            of extractNumbers(value)
        ) {
            numbers.add(number);
        }
    }

    return numbers;
}


function buildClaimDecision(
    claim,
    claimIndex,
    evidenceFields,
    evidenceNumbers
) {
    const text =
        String(
            claim?.text || ''
        ).trim();

    if (!text) {
        return {
            claimIndex,
            verdict:
                'UNSUPPORTED',
            evidence: [],
            reason:
                'Claim vazia.'
        };
    }

    const claimNumbers =
        extractNumbers(text);

    const inventedNumbers =
        claimNumbers.filter(
            number =>
                !evidenceNumbers.has(
                    number
                )
        );

    if (
        inventedNumbers.length > 0
    ) {
        return {
            claimIndex,
            verdict:
                'UNSUPPORTED',
            evidence: [],
            reason:
                `Número sem evidência: ${inventedNumbers.join(', ')}.`
        };
    }

    const evidence =
        findSupportingEvidence(
            text,
            evidenceFields
        );

    if (
        evidence.length === 0
    ) {
        return {
            claimIndex,
            verdict:
                'UNSUPPORTED',
            evidence: [],
            reason:
                'A afirmação não pôde ser ligada diretamente aos dados do produto.'
        };
    }

    return {
        claimIndex,
        verdict:
            'SUPPORTED',
        evidence,
        reason:
            'Afirmação encontrada nas evidências do produto.'
    };
}


function finalizeAudit(
    content,
    audit,
    evidenceFields
) {
    const sourceClaims =
        Array.isArray(
            content?.claims
        )
            ? content.claims
            : [];

    const decisions =
        Array.isArray(
            audit?.claims
        )
            ? audit.claims
            : [];

    const claimResults =
        sourceClaims.map(
            (claim, claimIndex) => {
                const decision =
                    decisions.find(
                        item =>
                            item
                                ?.claimIndex ===
                            claimIndex
                    );

                const citations =
                    Array.isArray(
                        decision?.evidence
                    )
                        ? decision.evidence
                        : [];

                const validEvidence =
                    citations.filter(
                        citation =>
                            verifyCitation(
                                citation,
                                evidenceFields
                            )
                    );

                let status =
                    decision?.verdict;

                if (
                    status ===
                        'SUPPORTED' &&
                    validEvidence.length ===
                        0
                ) {
                    status =
                        'UNSUPPORTED';
                }

                if (
                    ![
                        'SUPPORTED',
                        'UNCLEAR',
                        'UNSUPPORTED'
                    ].includes(status)
                ) {
                    status =
                        'UNSUPPORTED';
                }

                return {
                    claimIndex,

                    claim:
                        String(
                            claim?.text ||
                            ''
                        ).trim(),

                    status,

                    evidence:
                        validEvidence,

                    reason:
                        typeof decision
                            ?.reason ===
                            'string'
                            ? decision
                                .reason
                                .trim()
                            : 'Claim sem decisão válida.'
                };
            }
        );

    const status =
        claimResults.some(
            claim =>
                claim.status ===
                'UNSUPPORTED'
        )
            ? 'REJECTED'
            : claimResults.some(
                claim =>
                    claim.status ===
                    'UNCLEAR'
            )
                ? 'NEEDS_REVIEW'
                : 'APPROVED';

    return {
        status,
        claims:
            claimResults
    };
}


function createEvidenceAuditor(
    options = {}
) {
    /*
     * options é mantido apenas para
     * compatibilidade com chamadas antigas.
     * Nenhuma IA é usada aqui.
     */
    void options;

    async function audit(
        evidence,
        content
    ) {
        const startedAt =
            Date.now();

        const evidenceFields =
            flattenEvidence(
                evidence
            );

        const evidenceNumbers =
            getAllEvidenceNumbers(
                evidenceFields
            );

        /*
         * Proteção adicional:
         * qualquer número usado na legenda
         * precisa existir nas evidências.
         */
        const captionNumbers =
            extractNumbers(
                content?.caption
            );

        const unsupportedCaptionNumbers =
            captionNumbers.filter(
                number =>
                    !evidenceNumbers.has(
                        number
                    )
            );

        if (
            unsupportedCaptionNumbers
                .length > 0
        ) {
            const result = {
                status:
                    'REJECTED',

                claims: [],

                caption: {
                    status:
                        'UNSUPPORTED',

                    reason:
                        `A legenda contém número sem evidência: ${unsupportedCaptionNumbers.join(', ')}.`
                }
            };

            console.log(
                `[AUDIT] Determinístico: ${result.status} (${Date.now() - startedAt} ms)`
            );

            return result;
        }

        const sourceClaims =
            Array.isArray(
                content?.claims
            )
                ? content.claims
                : [];

        const decisions =
            sourceClaims.map(
                (claim, claimIndex) =>
                    buildClaimDecision(
                        claim,
                        claimIndex,
                        evidenceFields,
                        evidenceNumbers
                    )
            );

        const result =
            finalizeAudit(
                content,
                {
                    claims:
                        decisions
                },
                evidenceFields
            );

        result.caption = {
            status:
                'SUPPORTED',
            reason:
                'Nenhum número sem evidência foi encontrado na legenda.'
        };

        result.mode =
            'deterministic';

        result.elapsedMs =
            Date.now() -
            startedAt;

        console.log(
            `[AUDIT] Determinístico: ${result.status} (${result.elapsedMs} ms)`
        );

        return result;
    }

    return {
        audit
    };
}


module.exports = {
    AUDIT_FORMAT,
    SYSTEM_INSTRUCTIONS,
    flattenEvidence,
    verifyCitation,
    finalizeAudit,
    createEvidenceAuditor
};

