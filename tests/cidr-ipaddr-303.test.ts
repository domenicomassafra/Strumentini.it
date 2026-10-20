import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { cidrOperation, DeveloperWebError, runDeveloperWebTool } from "../src/engines/developer-web";

const oracleInputs = [
  "0.0.0.0/0", "203.0.113.9/0", "192.0.2.10/31", "192.0.2.10/32",
  "10.24.35.123/25", "172.16.4.99/18", "255.255.255.255/32",
  "::/0", "2001:db8::1/0", "2001:db8::5/127", "2001:db8::5/128",
  "2001:db8:0:1:0:0:0:2/64", "2001:db8:0:0:1:0:0:1/96",
  "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff/128",
];

describe("#303 — ipaddr.js 2.5.0 CIDR parity", () => {
  it("matches independent Python ipaddress oracle for complete network and range values", async () => {
    const script = [
      "import ipaddress,json,sys",
      "inputs=json.load(sys.stdin)",
      "for s in inputs:",
      " n=ipaddress.ip_network(s,strict=False)",
      " print(json.dumps({'input':s,'network':str(n.network_address)+'/'+str(n.prefixlen),'first':str(n.network_address),'last':str(n.broadcast_address),'count':str(n.num_addresses)}))",
    ].join("\n");
    const lines = execFileSync("python3", ["-c", script], { input: JSON.stringify(oracleInputs), encoding: "utf8" }).trim().split("\n");
    for (const line of lines) {
      const expected = JSON.parse(line) as { input: string; network: string; first: string; last: string; count: string };
      const actual = await cidrOperation(expected.input);
      expect(actual.network, expected.input).toBe(expected.network);
      expect(actual.range, expected.input).toEqual({ first: expected.first, last: expected.last });
      expect(actual.addressCount, expected.input).toBe(expected.count);
    }
  });

  it("keeps decimal leading zeroes and embedded IPv4 as defined by the previous calculator", async () => {
    expect(await cidrOperation("010.020.030.040/32")).toMatchObject({
      family: "IPv4", network: "10.20.30.40/32", broadcast: "10.20.30.40",
    });
    expect(await cidrOperation("::ffff:192.0.2.1/120")).toMatchObject({
      family: "IPv6", network: "::ffff:c000:200/120",
      range: { first: "::ffff:c000:200", last: "::ffff:c000:2ff" },
    });
    expect(await cidrOperation("2001:db8:0:0:1:0:0:1/128")).toMatchObject({
      network: "2001:db8::1:0:0:1/128",
    });
  });

  it("refuses ipaddr.js permissive short/octal IPv4 and zone ID forms", async () => {
    for (const input of [
      "127.1/8", "0x7f.0.0.1/8", "999.1.2.3/24", "192.0.2.1/33",
      "192.0.2.1/-1", "192.0.2.1/24/7", "2001::db8::1/64",
      "::1/129", "fe80::1%eth0/64", "::ffff:127.1/96",
    ]) {
      await expect(cidrOperation(input), input).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
    await expect(runDeveloperWebTool("cidr-calculator", { cidr: "127.1/8" })).rejects.toBeInstanceOf(DeveloperWebError);
  });

  it("honors cancellation before a lazy import or computation", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(cidrOperation("2001:db8::1/64", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});
