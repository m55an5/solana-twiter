import { useWorkspace } from "@/composables"
import * as anchor from "@project-serum/anchor";
import { Tweet } from "@/models";

export const sendTweet = async (topic, content) => {
    const { wallet, program } = useWorkspace()
    
    const tweet = anchor.web3.Keypair.generate()

    const tx = await program.value.rpc.sendTweet(topic, content, {
        accounts: {
            author: wallet.value.publicKey,
            tweet: tweet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [tweet]
    });

    await program.value.provider.connection.confirmTransaction(tx)
    console.log("--------------after---------",tx)

    const tweetAccount = await program.value.account.tweet.fetch(tweet.publicKey)

    return new Tweet(tweet.publicKey, tweetAccount)
}
