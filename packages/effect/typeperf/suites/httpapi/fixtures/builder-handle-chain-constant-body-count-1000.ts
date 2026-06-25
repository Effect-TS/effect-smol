// Measures HttpApiBuilder handle-chain scaling with inline handlers that return a constant body across 1000 same-shaped endpoints.
import { Effect, Schema } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"

Schema.String
HttpApi.make("Api")
HttpApiGroup.make("users")
HttpApiEndpoint.get("warmup", "/warmup")

const Params = Schema.Struct({
  id: Schema.FiniteFromString
})

const User = Schema.Struct({
  id: Schema.String,
  name: Schema.String
})

const group = HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("getUser0001", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0002", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0003", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0004", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0005", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0006", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0007", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0008", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0009", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0010", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0011", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0012", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0013", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0014", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0015", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0016", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0017", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0018", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0019", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0020", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0021", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0022", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0023", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0024", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0025", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0026", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0027", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0028", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0029", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0030", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0031", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0032", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0033", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0034", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0035", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0036", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0037", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0038", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0039", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0040", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0041", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0042", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0043", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0044", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0045", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0046", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0047", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0048", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0049", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0050", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0051", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0052", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0053", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0054", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0055", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0056", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0057", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0058", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0059", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0060", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0061", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0062", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0063", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0064", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0065", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0066", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0067", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0068", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0069", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0070", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0071", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0072", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0073", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0074", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0075", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0076", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0077", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0078", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0079", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0080", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0081", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0082", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0083", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0084", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0085", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0086", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0087", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0088", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0089", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0090", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0091", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0092", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0093", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0094", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0095", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0096", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0097", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0098", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0099", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0100", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0101", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0102", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0103", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0104", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0105", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0106", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0107", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0108", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0109", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0110", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0111", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0112", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0113", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0114", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0115", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0116", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0117", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0118", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0119", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0120", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0121", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0122", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0123", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0124", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0125", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0126", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0127", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0128", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0129", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0130", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0131", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0132", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0133", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0134", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0135", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0136", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0137", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0138", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0139", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0140", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0141", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0142", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0143", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0144", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0145", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0146", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0147", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0148", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0149", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0150", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0151", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0152", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0153", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0154", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0155", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0156", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0157", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0158", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0159", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0160", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0161", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0162", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0163", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0164", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0165", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0166", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0167", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0168", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0169", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0170", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0171", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0172", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0173", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0174", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0175", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0176", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0177", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0178", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0179", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0180", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0181", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0182", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0183", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0184", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0185", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0186", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0187", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0188", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0189", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0190", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0191", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0192", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0193", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0194", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0195", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0196", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0197", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0198", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0199", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0200", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0201", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0202", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0203", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0204", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0205", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0206", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0207", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0208", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0209", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0210", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0211", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0212", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0213", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0214", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0215", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0216", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0217", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0218", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0219", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0220", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0221", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0222", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0223", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0224", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0225", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0226", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0227", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0228", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0229", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0230", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0231", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0232", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0233", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0234", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0235", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0236", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0237", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0238", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0239", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0240", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0241", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0242", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0243", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0244", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0245", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0246", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0247", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0248", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0249", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0250", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0251", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0252", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0253", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0254", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0255", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0256", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0257", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0258", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0259", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0260", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0261", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0262", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0263", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0264", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0265", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0266", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0267", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0268", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0269", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0270", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0271", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0272", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0273", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0274", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0275", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0276", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0277", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0278", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0279", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0280", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0281", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0282", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0283", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0284", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0285", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0286", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0287", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0288", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0289", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0290", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0291", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0292", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0293", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0294", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0295", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0296", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0297", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0298", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0299", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0300", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0301", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0302", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0303", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0304", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0305", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0306", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0307", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0308", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0309", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0310", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0311", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0312", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0313", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0314", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0315", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0316", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0317", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0318", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0319", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0320", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0321", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0322", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0323", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0324", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0325", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0326", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0327", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0328", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0329", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0330", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0331", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0332", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0333", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0334", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0335", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0336", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0337", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0338", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0339", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0340", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0341", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0342", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0343", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0344", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0345", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0346", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0347", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0348", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0349", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0350", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0351", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0352", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0353", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0354", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0355", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0356", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0357", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0358", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0359", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0360", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0361", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0362", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0363", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0364", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0365", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0366", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0367", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0368", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0369", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0370", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0371", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0372", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0373", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0374", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0375", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0376", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0377", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0378", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0379", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0380", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0381", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0382", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0383", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0384", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0385", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0386", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0387", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0388", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0389", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0390", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0391", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0392", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0393", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0394", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0395", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0396", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0397", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0398", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0399", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0400", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0401", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0402", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0403", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0404", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0405", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0406", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0407", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0408", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0409", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0410", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0411", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0412", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0413", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0414", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0415", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0416", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0417", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0418", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0419", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0420", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0421", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0422", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0423", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0424", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0425", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0426", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0427", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0428", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0429", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0430", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0431", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0432", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0433", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0434", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0435", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0436", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0437", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0438", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0439", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0440", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0441", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0442", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0443", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0444", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0445", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0446", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0447", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0448", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0449", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0450", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0451", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0452", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0453", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0454", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0455", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0456", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0457", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0458", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0459", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0460", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0461", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0462", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0463", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0464", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0465", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0466", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0467", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0468", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0469", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0470", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0471", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0472", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0473", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0474", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0475", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0476", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0477", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0478", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0479", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0480", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0481", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0482", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0483", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0484", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0485", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0486", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0487", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0488", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0489", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0490", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0491", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0492", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0493", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0494", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0495", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0496", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0497", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0498", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0499", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0500", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0501", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0502", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0503", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0504", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0505", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0506", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0507", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0508", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0509", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0510", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0511", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0512", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0513", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0514", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0515", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0516", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0517", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0518", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0519", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0520", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0521", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0522", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0523", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0524", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0525", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0526", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0527", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0528", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0529", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0530", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0531", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0532", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0533", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0534", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0535", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0536", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0537", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0538", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0539", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0540", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0541", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0542", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0543", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0544", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0545", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0546", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0547", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0548", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0549", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0550", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0551", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0552", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0553", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0554", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0555", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0556", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0557", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0558", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0559", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0560", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0561", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0562", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0563", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0564", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0565", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0566", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0567", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0568", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0569", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0570", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0571", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0572", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0573", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0574", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0575", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0576", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0577", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0578", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0579", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0580", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0581", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0582", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0583", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0584", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0585", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0586", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0587", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0588", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0589", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0590", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0591", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0592", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0593", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0594", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0595", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0596", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0597", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0598", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0599", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0600", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0601", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0602", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0603", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0604", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0605", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0606", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0607", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0608", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0609", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0610", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0611", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0612", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0613", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0614", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0615", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0616", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0617", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0618", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0619", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0620", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0621", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0622", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0623", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0624", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0625", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0626", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0627", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0628", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0629", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0630", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0631", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0632", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0633", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0634", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0635", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0636", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0637", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0638", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0639", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0640", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0641", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0642", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0643", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0644", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0645", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0646", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0647", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0648", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0649", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0650", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0651", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0652", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0653", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0654", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0655", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0656", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0657", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0658", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0659", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0660", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0661", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0662", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0663", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0664", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0665", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0666", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0667", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0668", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0669", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0670", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0671", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0672", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0673", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0674", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0675", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0676", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0677", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0678", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0679", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0680", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0681", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0682", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0683", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0684", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0685", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0686", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0687", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0688", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0689", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0690", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0691", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0692", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0693", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0694", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0695", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0696", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0697", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0698", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0699", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0700", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0701", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0702", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0703", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0704", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0705", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0706", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0707", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0708", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0709", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0710", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0711", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0712", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0713", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0714", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0715", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0716", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0717", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0718", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0719", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0720", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0721", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0722", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0723", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0724", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0725", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0726", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0727", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0728", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0729", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0730", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0731", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0732", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0733", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0734", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0735", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0736", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0737", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0738", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0739", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0740", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0741", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0742", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0743", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0744", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0745", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0746", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0747", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0748", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0749", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0750", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0751", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0752", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0753", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0754", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0755", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0756", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0757", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0758", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0759", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0760", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0761", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0762", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0763", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0764", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0765", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0766", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0767", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0768", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0769", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0770", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0771", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0772", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0773", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0774", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0775", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0776", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0777", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0778", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0779", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0780", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0781", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0782", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0783", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0784", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0785", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0786", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0787", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0788", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0789", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0790", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0791", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0792", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0793", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0794", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0795", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0796", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0797", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0798", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0799", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0800", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0801", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0802", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0803", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0804", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0805", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0806", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0807", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0808", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0809", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0810", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0811", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0812", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0813", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0814", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0815", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0816", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0817", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0818", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0819", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0820", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0821", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0822", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0823", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0824", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0825", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0826", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0827", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0828", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0829", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0830", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0831", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0832", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0833", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0834", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0835", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0836", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0837", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0838", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0839", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0840", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0841", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0842", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0843", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0844", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0845", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0846", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0847", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0848", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0849", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0850", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0851", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0852", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0853", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0854", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0855", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0856", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0857", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0858", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0859", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0860", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0861", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0862", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0863", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0864", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0865", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0866", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0867", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0868", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0869", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0870", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0871", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0872", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0873", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0874", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0875", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0876", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0877", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0878", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0879", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0880", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0881", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0882", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0883", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0884", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0885", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0886", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0887", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0888", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0889", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0890", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0891", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0892", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0893", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0894", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0895", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0896", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0897", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0898", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0899", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0900", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0901", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0902", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0903", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0904", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0905", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0906", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0907", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0908", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0909", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0910", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0911", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0912", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0913", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0914", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0915", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0916", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0917", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0918", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0919", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0920", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0921", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0922", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0923", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0924", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0925", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0926", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0927", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0928", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0929", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0930", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0931", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0932", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0933", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0934", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0935", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0936", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0937", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0938", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0939", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0940", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0941", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0942", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0943", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0944", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0945", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0946", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0947", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0948", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0949", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0950", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0951", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0952", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0953", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0954", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0955", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0956", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0957", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0958", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0959", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0960", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0961", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0962", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0963", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0964", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0965", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0966", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0967", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0968", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0969", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0970", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0971", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0972", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0973", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0974", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0975", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0976", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0977", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0978", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0979", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0980", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0981", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0982", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0983", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0984", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0985", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0986", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0987", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0988", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0989", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0990", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0991", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0992", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0993", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0994", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0995", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0996", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0997", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0998", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0999", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser1000", "/users/:id", {
    params: Params,
    success: User
  })
)

const api = HttpApi.make("Api").add(group)

const layer = HttpApiBuilder.group(api, "users", (handlers) =>
  handlers
    .handle("getUser0001", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0002", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0003", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0004", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0005", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0006", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0007", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0008", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0009", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0010", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0011", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0012", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0013", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0014", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0015", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0016", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0017", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0018", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0019", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0020", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0021", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0022", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0023", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0024", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0025", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0026", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0027", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0028", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0029", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0030", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0031", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0032", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0033", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0034", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0035", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0036", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0037", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0038", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0039", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0040", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0041", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0042", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0043", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0044", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0045", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0046", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0047", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0048", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0049", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0050", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0051", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0052", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0053", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0054", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0055", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0056", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0057", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0058", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0059", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0060", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0061", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0062", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0063", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0064", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0065", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0066", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0067", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0068", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0069", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0070", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0071", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0072", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0073", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0074", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0075", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0076", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0077", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0078", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0079", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0080", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0081", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0082", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0083", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0084", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0085", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0086", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0087", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0088", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0089", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0090", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0091", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0092", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0093", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0094", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0095", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0096", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0097", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0098", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0099", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0100", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0101", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0102", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0103", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0104", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0105", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0106", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0107", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0108", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0109", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0110", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0111", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0112", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0113", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0114", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0115", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0116", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0117", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0118", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0119", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0120", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0121", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0122", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0123", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0124", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0125", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0126", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0127", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0128", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0129", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0130", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0131", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0132", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0133", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0134", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0135", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0136", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0137", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0138", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0139", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0140", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0141", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0142", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0143", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0144", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0145", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0146", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0147", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0148", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0149", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0150", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0151", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0152", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0153", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0154", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0155", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0156", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0157", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0158", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0159", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0160", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0161", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0162", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0163", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0164", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0165", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0166", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0167", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0168", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0169", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0170", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0171", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0172", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0173", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0174", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0175", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0176", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0177", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0178", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0179", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0180", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0181", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0182", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0183", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0184", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0185", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0186", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0187", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0188", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0189", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0190", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0191", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0192", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0193", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0194", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0195", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0196", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0197", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0198", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0199", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0200", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0201", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0202", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0203", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0204", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0205", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0206", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0207", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0208", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0209", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0210", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0211", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0212", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0213", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0214", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0215", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0216", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0217", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0218", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0219", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0220", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0221", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0222", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0223", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0224", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0225", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0226", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0227", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0228", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0229", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0230", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0231", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0232", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0233", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0234", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0235", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0236", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0237", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0238", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0239", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0240", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0241", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0242", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0243", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0244", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0245", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0246", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0247", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0248", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0249", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0250", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0251", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0252", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0253", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0254", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0255", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0256", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0257", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0258", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0259", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0260", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0261", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0262", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0263", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0264", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0265", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0266", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0267", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0268", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0269", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0270", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0271", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0272", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0273", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0274", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0275", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0276", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0277", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0278", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0279", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0280", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0281", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0282", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0283", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0284", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0285", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0286", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0287", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0288", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0289", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0290", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0291", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0292", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0293", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0294", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0295", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0296", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0297", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0298", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0299", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0300", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0301", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0302", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0303", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0304", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0305", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0306", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0307", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0308", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0309", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0310", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0311", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0312", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0313", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0314", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0315", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0316", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0317", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0318", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0319", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0320", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0321", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0322", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0323", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0324", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0325", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0326", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0327", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0328", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0329", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0330", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0331", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0332", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0333", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0334", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0335", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0336", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0337", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0338", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0339", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0340", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0341", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0342", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0343", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0344", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0345", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0346", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0347", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0348", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0349", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0350", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0351", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0352", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0353", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0354", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0355", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0356", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0357", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0358", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0359", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0360", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0361", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0362", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0363", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0364", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0365", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0366", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0367", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0368", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0369", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0370", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0371", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0372", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0373", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0374", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0375", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0376", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0377", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0378", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0379", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0380", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0381", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0382", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0383", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0384", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0385", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0386", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0387", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0388", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0389", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0390", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0391", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0392", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0393", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0394", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0395", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0396", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0397", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0398", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0399", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0400", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0401", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0402", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0403", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0404", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0405", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0406", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0407", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0408", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0409", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0410", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0411", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0412", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0413", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0414", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0415", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0416", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0417", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0418", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0419", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0420", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0421", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0422", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0423", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0424", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0425", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0426", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0427", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0428", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0429", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0430", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0431", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0432", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0433", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0434", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0435", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0436", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0437", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0438", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0439", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0440", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0441", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0442", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0443", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0444", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0445", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0446", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0447", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0448", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0449", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0450", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0451", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0452", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0453", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0454", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0455", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0456", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0457", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0458", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0459", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0460", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0461", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0462", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0463", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0464", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0465", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0466", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0467", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0468", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0469", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0470", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0471", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0472", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0473", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0474", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0475", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0476", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0477", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0478", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0479", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0480", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0481", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0482", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0483", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0484", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0485", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0486", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0487", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0488", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0489", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0490", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0491", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0492", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0493", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0494", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0495", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0496", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0497", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0498", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0499", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0500", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0501", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0502", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0503", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0504", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0505", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0506", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0507", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0508", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0509", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0510", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0511", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0512", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0513", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0514", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0515", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0516", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0517", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0518", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0519", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0520", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0521", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0522", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0523", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0524", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0525", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0526", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0527", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0528", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0529", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0530", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0531", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0532", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0533", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0534", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0535", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0536", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0537", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0538", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0539", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0540", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0541", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0542", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0543", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0544", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0545", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0546", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0547", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0548", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0549", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0550", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0551", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0552", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0553", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0554", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0555", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0556", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0557", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0558", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0559", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0560", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0561", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0562", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0563", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0564", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0565", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0566", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0567", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0568", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0569", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0570", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0571", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0572", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0573", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0574", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0575", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0576", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0577", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0578", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0579", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0580", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0581", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0582", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0583", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0584", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0585", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0586", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0587", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0588", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0589", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0590", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0591", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0592", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0593", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0594", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0595", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0596", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0597", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0598", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0599", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0600", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0601", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0602", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0603", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0604", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0605", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0606", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0607", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0608", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0609", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0610", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0611", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0612", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0613", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0614", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0615", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0616", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0617", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0618", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0619", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0620", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0621", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0622", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0623", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0624", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0625", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0626", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0627", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0628", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0629", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0630", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0631", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0632", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0633", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0634", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0635", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0636", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0637", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0638", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0639", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0640", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0641", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0642", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0643", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0644", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0645", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0646", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0647", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0648", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0649", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0650", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0651", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0652", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0653", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0654", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0655", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0656", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0657", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0658", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0659", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0660", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0661", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0662", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0663", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0664", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0665", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0666", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0667", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0668", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0669", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0670", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0671", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0672", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0673", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0674", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0675", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0676", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0677", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0678", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0679", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0680", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0681", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0682", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0683", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0684", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0685", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0686", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0687", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0688", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0689", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0690", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0691", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0692", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0693", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0694", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0695", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0696", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0697", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0698", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0699", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0700", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0701", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0702", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0703", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0704", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0705", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0706", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0707", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0708", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0709", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0710", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0711", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0712", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0713", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0714", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0715", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0716", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0717", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0718", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0719", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0720", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0721", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0722", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0723", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0724", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0725", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0726", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0727", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0728", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0729", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0730", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0731", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0732", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0733", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0734", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0735", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0736", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0737", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0738", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0739", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0740", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0741", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0742", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0743", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0744", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0745", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0746", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0747", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0748", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0749", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0750", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0751", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0752", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0753", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0754", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0755", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0756", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0757", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0758", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0759", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0760", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0761", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0762", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0763", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0764", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0765", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0766", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0767", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0768", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0769", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0770", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0771", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0772", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0773", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0774", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0775", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0776", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0777", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0778", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0779", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0780", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0781", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0782", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0783", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0784", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0785", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0786", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0787", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0788", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0789", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0790", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0791", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0792", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0793", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0794", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0795", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0796", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0797", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0798", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0799", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0800", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0801", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0802", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0803", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0804", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0805", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0806", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0807", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0808", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0809", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0810", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0811", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0812", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0813", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0814", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0815", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0816", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0817", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0818", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0819", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0820", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0821", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0822", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0823", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0824", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0825", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0826", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0827", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0828", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0829", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0830", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0831", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0832", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0833", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0834", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0835", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0836", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0837", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0838", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0839", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0840", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0841", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0842", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0843", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0844", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0845", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0846", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0847", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0848", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0849", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0850", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0851", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0852", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0853", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0854", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0855", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0856", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0857", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0858", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0859", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0860", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0861", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0862", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0863", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0864", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0865", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0866", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0867", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0868", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0869", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0870", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0871", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0872", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0873", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0874", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0875", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0876", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0877", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0878", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0879", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0880", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0881", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0882", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0883", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0884", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0885", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0886", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0887", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0888", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0889", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0890", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0891", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0892", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0893", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0894", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0895", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0896", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0897", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0898", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0899", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0900", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0901", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0902", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0903", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0904", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0905", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0906", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0907", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0908", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0909", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0910", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0911", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0912", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0913", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0914", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0915", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0916", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0917", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0918", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0919", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0920", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0921", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0922", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0923", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0924", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0925", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0926", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0927", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0928", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0929", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0930", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0931", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0932", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0933", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0934", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0935", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0936", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0937", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0938", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0939", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0940", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0941", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0942", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0943", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0944", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0945", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0946", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0947", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0948", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0949", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0950", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0951", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0952", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0953", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0954", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0955", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0956", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0957", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0958", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0959", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0960", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0961", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0962", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0963", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0964", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0965", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0966", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0967", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0968", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0969", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0970", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0971", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0972", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0973", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0974", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0975", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0976", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0977", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0978", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0979", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0980", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0981", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0982", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0983", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0984", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0985", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0986", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0987", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0988", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0989", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0990", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0991", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0992", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0993", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0994", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0995", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0996", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0997", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0998", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser0999", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      }))
    .handle("getUser1000", () =>
      Effect.succeed({
        id: "1",
        name: "Ada"
      })))

export type Layer = typeof layer
export type Handlers = HttpApiBuilder.Handlers.FromGroup<typeof group>
