import { ESLintUtils, TSESTree, TSESLint } from "@typescript-eslint/experimental-utils";

/*
TODO:
- Optimize by checking for imports?
*/

const createRule = ESLintUtils.RuleCreator(
    (name) =>
        `https://github.com/MedFlyt/medflyt_server2/blob/packages/eslint-plugin-graphql-type-checker/docs/rules/${name}.md`,
);

const messages = { test: "TEST MESSAGE" };
type MessageId = keyof typeof messages;

// stolen from ts-gql, probably also available in some package
export function* getNodes(context: TSESLint.RuleContext<any, any>, node: TSESTree.Node) {
    let allVisitorKeys = context.getSourceCode().visitorKeys;
    let queue = [node];

    while (queue.length) {
        let currentNode = queue.shift()!;

        yield currentNode;

        let visitorKeys = allVisitorKeys[currentNode.type];
        if (!visitorKeys) continue;

        for (let visitorKey of visitorKeys) {
            let child = (currentNode as any)[visitorKey] as
                | TSESTree.Node
                | TSESTree.Node[]
                | undefined;

            if (!child) {
                continue;
            } else if (Array.isArray(child)) {
                queue.push(...child);
            } else {
                queue.push(child);
            }
        }
    }
}

export const rules = {
    "check-query-types": createRule<[], MessageId>({
        name: "ts-gql",
        meta: {
            fixable: "code",
            docs: {
                requiresTypeChecking: true,
                category: "Best Practices",
                recommended: "error",
                description: "",
            },
            messages,
            type: "problem",
            schema: [],
        },
        defaultOptions: [],
        create(context) {
            return {
                // TemplateLiteral(node: TSESTree.TemplateLiteral) {
                //     (context.report as any)(node, "Yo");
                // },
                Program(programNode) {
                    // Easy AST viewing: https://ts-ast-viewer.com/
                    // console.log(programNode);
                    const allNodes: TSESTree.Node[] = [...getNodes(context, programNode)];
                    for (const node of allNodes) {
                        console.log("node:", node.type, "name" in node ? `"${node.name}"` : "");
                        // if (node.type === "TSTypeAnnotation") {
                        //     console.log("TSTypeAnnotation", node);
                        // }
                        if (node.type === "CallExpression") {
                            const { callee, arguments: args } = node;
                            console.log("CallExpression", node);
                            if (callee.type === "MemberExpression") {
                                if (
                                    callee.property.type === "Identifier" &&
                                    callee.property.name === "query" &&
                                    callee.object.type === "Identifier" &&
                                    callee.object.name === "CaregiverGraphQL"
                                ) {
                                    console.log("TYPE ANNOTATION", node.typeParameters);
                                    console.log(
                                        "PROPERTY",
                                        callee.property.type,
                                        callee.property.name,
                                    );
                                    console.log("OBJECT", callee.object);
                                    context.report({
                                        messageId: "test",
                                        node,
                                        fix(fix) {
                                            const targetRange: TSESTree.Range = node.typeParameters
                                                ? node.typeParameters.range
                                                : [callee.range[1], callee.range[1]];
                                            console.log("TARGET RANGE", targetRange);
                                            return fix.replaceTextRange(targetRange, "<{},{}>");
                                        },
                                    });
                                }
                            }
                        }

                        // if (node.type === "TSTypeReference") {
                        //     console.log("TSTypeReference", node);
                        // }

                        // if (node.type === "MemberExpression") {
                        //     if (
                        //         node.property.type === "Identifier" &&
                        //         node.property.name === "query" &&
                        //         node.object.type === "Identifier" &&
                        //         node.object.name === "CaregiverGraphQL"
                        //     ) {
                        //         console.log(node.property.type, node.property.name);
                        //         console.log(node.object);
                        //         context.report({
                        //             messageId: "test",
                        //             node,
                        //             fix(fix) {
                        //                 return fix.insertTextAfter(node, "<{},{}>");
                        //             },
                        //         });
                        //     }
                        // }
                    }
                },
            };
        },
    }),
};
