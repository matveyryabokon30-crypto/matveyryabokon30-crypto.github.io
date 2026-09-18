/* Send only microphone input to the owning page. Output remains silent. */
class SekkesPCM extends AudioWorkletProcessor {
  process(inputs,outputs){const x=inputs[0]?.[0];if(x)this.port.postMessage(x.slice());for(const out of outputs)for(const channel of out)channel.fill(0);return true;}
}
registerProcessor('sekkes-pcm',SekkesPCM);
