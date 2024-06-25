import { NearBindgen, near, call, view, UnorderedMap, assert, NearPromise, bytes, PromiseIndex } from 'near-sdk-js';

@NearBindgen({})
class RelaySponsor {
  sponsor_balance_map: UnorderedMap<bigint> = new UnorderedMap<bigint>('sponsor_contract');
  depositor_map: UnorderedMap<string> = new UnorderedMap<string>('contract')

  @view({}) 
  sponsor_balance({ sponsor_contract }: { sponsor_contract: string }): bigint {
    const balance = this.sponsor_balance_map.get(sponsor_contract);
    return balance ? balance : BigInt(0);
  }

  @view({}) 
  sponsorship_contract({ sponsor_contract }: { sponsor_contract: string }): bigint {
    return this.sponsor_balance_map.get(sponsor_contract) || BigInt(0);
  }

  @call({payableFunction: true}) 
  pay_sponsorship({ sponsorship_contract }: { sponsorship_contract: string }): void {
      if (!sponsorship_contract) {
        throw new Error("Invalid input: sponsorship_contract must be a valid string.");
      }

      const depositor_contract = this.depositor_map.get(near.signerAccountId());

      if(depositor_contract){
        assert(this.depositor_map.get(near.signerAccountId()) === sponsorship_contract, "This account isn't a valid depositor")
      }
      
      const amount = near.attachedDeposit();
      const one_near = BigInt(1000000000000000000000000);

      assert(amount >= one_near, "Deposit must be at least 1N");
    
      const current_balance = this.sponsor_balance_map.get(sponsorship_contract) || BigInt(0);

      this.sponsor_balance_map.set(sponsorship_contract, current_balance + amount);
      near.log(`Added sponsoring with: ${current_balance + amount} for ${sponsorship_contract}`);

      if(!depositor_contract){
        this.depositor_map.set(near.signerAccountId(), sponsorship_contract)
      }    
  }

  @call({}) 
  withdraw_sponshorship({amount}: {amount: string}): void {
    
    const sender = near.signerAccountId();
    const depositor_contract = this.depositor_map.get(sender)
    assert(depositor_contract, "No deposits on any contract for account")

    const current_amount = this.sponsor_balance_map.get(depositor_contract);
    const new_amount = current_amount - BigInt(amount)
    assert(new_amount > 0, "Balance to withdraw is more then what is available")
    this.sponsor_balance_map.set(depositor_contract, new_amount)
    near.log("Updated sponsoring with:", new_amount, depositor_contract)
    return  
  }

  @call({payableFunction: true})
  proxy_function_call({ receiver, method, args, deposit, gas }: { receiver: string, method: string, args: any, deposit?: bigint, gas?: bigint }) {
    const sponsorship_balance = this.sponsor_balance_map.get(receiver);
    assert(sponsorship_balance, "No sponsorship contract found for contract");
    near.log("Old balance: ", sponsorship_balance )
    const callDeposit = deposit || BigInt(0);
    const one_near = BigInt(1000000000000000000000000);
    
    assert(callDeposit < one_near, "Deposit needs to be less than 1N");
  
    const callGas = gas || BigInt("10000000000000");
  
    assert(sponsorship_balance > (callDeposit + callGas), "The balance for this sponsorship is not enough for the deposit and gas costs");
  
    return NearPromise.new(receiver)
      .functionCall(method, JSON.stringify(args), callDeposit, callGas)
      .then(
        NearPromise.new(near.currentAccountId())
          .functionCall(
            "subtract_amount_from_sponsor_callback",
            JSON.stringify({
              receiver: receiver,
              sponsorship_balance: sponsorship_balance.toString(),
              usedGas: near.usedGas().toString(),
              usedStorage: near.storageUsage().toString(),
            }),
            BigInt(0), 
            callGas
          )
      )
      .asReturn();
  }
  
  @call({privateFunction: true})
subtract_amount_from_sponsor_callback({receiver, sponsorship_balance, usedGas, usedStorage}): String {
  const {result, success} = promiseResult();
  if (success) {
   
    const sponsorship_balance_bigint = BigInt(sponsorship_balance);
    const usedGasBigInt = BigInt(usedGas);
    const usedStorageBigInt = BigInt(usedStorage);

    const new_balance = sponsorship_balance_bigint - (usedGasBigInt + usedStorageBigInt);
    this.sponsor_balance_map.set(receiver, new_balance);

    near.log("Remaining balance: ", new_balance )


    return result;
  } else {
    throw new Error("oopsie");
  }
}
  
}
function promiseResult(): {result: string, success: boolean}{
  let result, success;
  
  try{ result = near.promiseResult(0 as PromiseIndex); success = true }
  catch{ result = undefined; success = false }
  
  return {result, success}
}
  //TODO: Keep track of who set sponsorship and let them withdraw

 

  // Docs Improvements 

  //near login
  //promiseResult
  //yocto near conversion
  //deployment path is wrong