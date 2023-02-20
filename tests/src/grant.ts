import { pause, runScenario } from "@holochain/tryorama";
import pkg from "tape-promise/tape";
const { test } = pkg;
import { ActionHash } from "@holochain/client";

import { Base64 } from "js-base64";
import { installApp, privatePublicationApp } from "./utils";

export function deserializeHash(hash: string): Uint8Array {
  return Base64.toUint8Array(hash.slice(1));
}

export function serializeHash(hash: Uint8Array): string {
  return `u${Base64.fromUint8Array(hash, true)}`;
}

const isExercise = process.env["EXERCISE"] === "1";
const stepNum = isExercise && parseInt(process.env["STEP"] as string);

export default () =>
  test("Grant capability", async (t) => {
    try {
      await runScenario(async (scenario) => {
        const [aliceConductor, alice] = await installApp(scenario);
        const [bobConductor, bob] = await installApp(scenario);

        await aliceConductor.appAgentWs().createCloneCell({
          role_name: "private_publication",
          modifiers: {
            network_seed: "test",
            properties: {
              progenitor: serializeHash(alice.agentPubKey),
            },
          },
        });

        // Shortcut peer discovery through gossip and register all agents in every
        // conductor of the scenario.
        await scenario.shareAllAgents();

        const aliceLobby = alice.namedCells.get("lobby")!;
        const bobLobby = bob.namedCells.get("lobby")!;

        await aliceConductor.appAgentWs().callZome({
          role_name: "private_publication.0",
          fn_name: "create_post",
          payload: {
            title: "Post 1",
            content: "Posts post",
          },
          zome_name: "posts",
        });

        let allPosts: Array<ActionHash> = await aliceLobby.callZome({
          fn_name: "request_read_all_posts",
          payload: null,
          provenance: alice.agentPubKey,
          zome_name: "private_publication_lobby",
        });
        t.equal(allPosts.length, 1);
        if (isExercise && stepNum === 1) return;

        try {
          const allPosts: any = await bobLobby.callZome({
            fn_name: "read_all_posts",
            payload: alice.agentPubKey,
            zome_name: "private_publication_lobby",
          });
          t.ok(false);
        } catch (e) {
          t.ok(true);
        }

        const secret = await aliceLobby.callZome({
          fn_name: "grant_capability_to_read",
          payload: bob.agentPubKey,
          provenance: alice.agentPubKey,
          zome_name: "private_publication_lobby",
        });
        if (isExercise && stepNum === 2) return;

        await bobLobby.callZome({
          fn_name: "store_capability_claim",
          payload: { cap_secret: secret, grantor: alice.agentPubKey },
          provenance: bob.agentPubKey,
          zome_name: "private_publication_lobby",
        });
        if (isExercise && stepNum === 3) return;

        allPosts = await bobLobby.callZome({
          fn_name: "read_all_posts",
          payload: alice.agentPubKey,
          zome_name: "private_publication_lobby",
        });
        t.equal(allPosts.length, 1);

        if (isExercise && stepNum === 4) return;
      });
    } catch (e) {
      console.log(e);
      process.exit(1);
    }
  });
