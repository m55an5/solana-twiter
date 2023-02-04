import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SolanaTwiter } from "../target/types/solana_twiter";
import * as assert from "assert";
import * as bs58 from "bs58";

describe("solana-twiter", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SolanaTwiter as Program<SolanaTwiter>;

  it('can send a new tweet', async () => {
    // Before sending the transaction to the blockchain.
    const tweet = anchor.web3.Keypair.generate();

    await program.rpc.sendTweet('odrow', 'cuto ha', {
        accounts: {
            tweet: tweet.publicKey,
            author: anchor.AnchorProvider.env().wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [tweet],
    });

    // After sending the transaction to the blockchain.
    // fetch 
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);
    // console.log(tweetAccount);

    // Ensure it has the right data.
    assert.equal(tweetAccount.author.toBase58(), anchor.AnchorProvider.env().wallet.publicKey.toBase58());
    assert.equal(tweetAccount.topic, 'odrow');
    assert.equal(tweetAccount.content, 'cuto ha');
    assert.ok(tweetAccount.timestamp);
  });

  it('it can send a new tweet without topic', async () => {
    const tweet = anchor.web3.Keypair.generate();
    // console.log("------1----", anchor.AnchorProvider.env().wallet.publicKey);
    // console.log("------2----", program.provider.publicKey);

    await program.rpc.sendTweet('', 'cuto, no topic this time', {
        accounts: {
          tweet: tweet.publicKey,
          author: program.provider.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [tweet],
    });

    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);
    assert.equal(tweetAccount.author.toBase58(), anchor.AnchorProvider.env().wallet.publicKey.toBase58());
    assert.equal(tweetAccount.topic, '');
    assert.equal(tweetAccount.content, 'cuto, no topic this time');
    assert.ok(tweetAccount.timestamp);    
  });

  it('it can send tweet from a different author', async () => {
    const tweet = anchor.web3.Keypair.generate();
    const otherUser = anchor.web3.Keypair.generate();
    const signature = await program.provider.connection.requestAirdrop(otherUser.publicKey, 1000000000);
    await program.provider.connection.confirmTransaction(signature);

    await program.rpc.sendTweet('new-author', 'new suthors tweet', {
        accounts: {
          tweet: tweet.publicKey,
          author: otherUser.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        // Note that Anchor will only automatically sign transactions using 
        // our wallet which is why we need to explicitly sign here.
        signers: [otherUser, tweet],
    });

    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);
    assert.equal(tweetAccount.author.toBase58(), otherUser.publicKey.toBase58());
    assert.equal(tweetAccount.topic, 'new-author');
    assert.equal(tweetAccount.content, 'new suthors tweet');
    assert.ok(tweetAccount.timestamp);
  });

  it('cannot provide a topic with more than 50 characters',async () => {
    try {
      const tweet = anchor.web3.Keypair.generate();
      const topic51Chars = 'x'.repeat(51);
      await program.rpc.sendTweet(topic51Chars, 'this should fail', {
        accounts: {
          tweet: tweet.publicKey,
          author: program.provider.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [tweet],
      });
    } catch (error) {
      assert.equal(error.error.errorMessage, 'The provided topic should be 50 characters long maximum.');
      return
    }
    assert.fail('The instruction should have failed with a 51-character topic.');
  });
  
  it('cannot provide a content with more than 280 characters',async () => {
    try {
      const tweet = anchor.web3.Keypair.generate();
      const content51Chars = 'x'.repeat(281);
      await program.rpc.sendTweet('this should fail', content51Chars, {
        accounts: {
          tweet: tweet.publicKey,
          author: program.provider.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [tweet],
      });
    } catch (error) {
      assert.equal(error.error.errorMessage, 'The provided content should be 280 characters long maximum.');
      return
    }
    assert.fail('The instruction should have failed with a 281-character content.');
  });

  it('can fetch all tweets',async () => {
    const tweetAccounts = await program.account.tweet.all();
    assert.equal(tweetAccounts.length, 3);
  });

  it('can filter tweets by author', async () => {
    const authorPublicKey = program.provider.publicKey;
    const tweetAccounts = await program.account.tweet.all([
      {
        memcmp: {
          offset: 8, //discriminator
          bytes: authorPublicKey.toBase58(),
        }
      }
    ]);
    assert.equal(tweetAccounts.length, 2);
    assert.ok(tweetAccounts.every(tweetAccount => {
      return tweetAccount.account.author.toBase58() === authorPublicKey.toBase58()
    }));
  });

  it('can filter by topic', async () => {
    // we can't just give 'ODROW' as a string to the bytes property. It needs to 
    // be a base-58 encoded array of bytes. To do this, we first need to 
    // convert our string to a buffer which we can then encode in base 58.
    const topicBuffer = Buffer.from("odrow");
    const encodeTopic = bs58.encode(topicBuffer);
    const tweetAccounts = await program.account.tweet.all([
      {
        memcmp: {
          offset: 8 + // Discriminator.
                32 + // Author public key.
                8 + // Timestamp.
                4, // Topic string prefix.
          bytes: encodeTopic,
        }
      }
    ]);

    assert.equal(tweetAccounts.length, 1);
    assert.ok(tweetAccounts.every(tweetAccount => {
      return tweetAccount.account.topic === "odrow"
    }));
  });

});
