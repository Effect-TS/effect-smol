// Measures HttpApiBuilder handle-chain scaling with an erased declared handler across 1000 same-shaped endpoints.
import { Schema } from "effect"
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

declare const handler: HttpApiEndpoint.Handler<any, never, never>

const layer = HttpApiBuilder.group(api, "users", (handlers) =>
  handlers
    .handle("getUser0001", handler)
    .handle("getUser0002", handler)
    .handle("getUser0003", handler)
    .handle("getUser0004", handler)
    .handle("getUser0005", handler)
    .handle("getUser0006", handler)
    .handle("getUser0007", handler)
    .handle("getUser0008", handler)
    .handle("getUser0009", handler)
    .handle("getUser0010", handler)
    .handle("getUser0011", handler)
    .handle("getUser0012", handler)
    .handle("getUser0013", handler)
    .handle("getUser0014", handler)
    .handle("getUser0015", handler)
    .handle("getUser0016", handler)
    .handle("getUser0017", handler)
    .handle("getUser0018", handler)
    .handle("getUser0019", handler)
    .handle("getUser0020", handler)
    .handle("getUser0021", handler)
    .handle("getUser0022", handler)
    .handle("getUser0023", handler)
    .handle("getUser0024", handler)
    .handle("getUser0025", handler)
    .handle("getUser0026", handler)
    .handle("getUser0027", handler)
    .handle("getUser0028", handler)
    .handle("getUser0029", handler)
    .handle("getUser0030", handler)
    .handle("getUser0031", handler)
    .handle("getUser0032", handler)
    .handle("getUser0033", handler)
    .handle("getUser0034", handler)
    .handle("getUser0035", handler)
    .handle("getUser0036", handler)
    .handle("getUser0037", handler)
    .handle("getUser0038", handler)
    .handle("getUser0039", handler)
    .handle("getUser0040", handler)
    .handle("getUser0041", handler)
    .handle("getUser0042", handler)
    .handle("getUser0043", handler)
    .handle("getUser0044", handler)
    .handle("getUser0045", handler)
    .handle("getUser0046", handler)
    .handle("getUser0047", handler)
    .handle("getUser0048", handler)
    .handle("getUser0049", handler)
    .handle("getUser0050", handler)
    .handle("getUser0051", handler)
    .handle("getUser0052", handler)
    .handle("getUser0053", handler)
    .handle("getUser0054", handler)
    .handle("getUser0055", handler)
    .handle("getUser0056", handler)
    .handle("getUser0057", handler)
    .handle("getUser0058", handler)
    .handle("getUser0059", handler)
    .handle("getUser0060", handler)
    .handle("getUser0061", handler)
    .handle("getUser0062", handler)
    .handle("getUser0063", handler)
    .handle("getUser0064", handler)
    .handle("getUser0065", handler)
    .handle("getUser0066", handler)
    .handle("getUser0067", handler)
    .handle("getUser0068", handler)
    .handle("getUser0069", handler)
    .handle("getUser0070", handler)
    .handle("getUser0071", handler)
    .handle("getUser0072", handler)
    .handle("getUser0073", handler)
    .handle("getUser0074", handler)
    .handle("getUser0075", handler)
    .handle("getUser0076", handler)
    .handle("getUser0077", handler)
    .handle("getUser0078", handler)
    .handle("getUser0079", handler)
    .handle("getUser0080", handler)
    .handle("getUser0081", handler)
    .handle("getUser0082", handler)
    .handle("getUser0083", handler)
    .handle("getUser0084", handler)
    .handle("getUser0085", handler)
    .handle("getUser0086", handler)
    .handle("getUser0087", handler)
    .handle("getUser0088", handler)
    .handle("getUser0089", handler)
    .handle("getUser0090", handler)
    .handle("getUser0091", handler)
    .handle("getUser0092", handler)
    .handle("getUser0093", handler)
    .handle("getUser0094", handler)
    .handle("getUser0095", handler)
    .handle("getUser0096", handler)
    .handle("getUser0097", handler)
    .handle("getUser0098", handler)
    .handle("getUser0099", handler)
    .handle("getUser0100", handler)
    .handle("getUser0101", handler)
    .handle("getUser0102", handler)
    .handle("getUser0103", handler)
    .handle("getUser0104", handler)
    .handle("getUser0105", handler)
    .handle("getUser0106", handler)
    .handle("getUser0107", handler)
    .handle("getUser0108", handler)
    .handle("getUser0109", handler)
    .handle("getUser0110", handler)
    .handle("getUser0111", handler)
    .handle("getUser0112", handler)
    .handle("getUser0113", handler)
    .handle("getUser0114", handler)
    .handle("getUser0115", handler)
    .handle("getUser0116", handler)
    .handle("getUser0117", handler)
    .handle("getUser0118", handler)
    .handle("getUser0119", handler)
    .handle("getUser0120", handler)
    .handle("getUser0121", handler)
    .handle("getUser0122", handler)
    .handle("getUser0123", handler)
    .handle("getUser0124", handler)
    .handle("getUser0125", handler)
    .handle("getUser0126", handler)
    .handle("getUser0127", handler)
    .handle("getUser0128", handler)
    .handle("getUser0129", handler)
    .handle("getUser0130", handler)
    .handle("getUser0131", handler)
    .handle("getUser0132", handler)
    .handle("getUser0133", handler)
    .handle("getUser0134", handler)
    .handle("getUser0135", handler)
    .handle("getUser0136", handler)
    .handle("getUser0137", handler)
    .handle("getUser0138", handler)
    .handle("getUser0139", handler)
    .handle("getUser0140", handler)
    .handle("getUser0141", handler)
    .handle("getUser0142", handler)
    .handle("getUser0143", handler)
    .handle("getUser0144", handler)
    .handle("getUser0145", handler)
    .handle("getUser0146", handler)
    .handle("getUser0147", handler)
    .handle("getUser0148", handler)
    .handle("getUser0149", handler)
    .handle("getUser0150", handler)
    .handle("getUser0151", handler)
    .handle("getUser0152", handler)
    .handle("getUser0153", handler)
    .handle("getUser0154", handler)
    .handle("getUser0155", handler)
    .handle("getUser0156", handler)
    .handle("getUser0157", handler)
    .handle("getUser0158", handler)
    .handle("getUser0159", handler)
    .handle("getUser0160", handler)
    .handle("getUser0161", handler)
    .handle("getUser0162", handler)
    .handle("getUser0163", handler)
    .handle("getUser0164", handler)
    .handle("getUser0165", handler)
    .handle("getUser0166", handler)
    .handle("getUser0167", handler)
    .handle("getUser0168", handler)
    .handle("getUser0169", handler)
    .handle("getUser0170", handler)
    .handle("getUser0171", handler)
    .handle("getUser0172", handler)
    .handle("getUser0173", handler)
    .handle("getUser0174", handler)
    .handle("getUser0175", handler)
    .handle("getUser0176", handler)
    .handle("getUser0177", handler)
    .handle("getUser0178", handler)
    .handle("getUser0179", handler)
    .handle("getUser0180", handler)
    .handle("getUser0181", handler)
    .handle("getUser0182", handler)
    .handle("getUser0183", handler)
    .handle("getUser0184", handler)
    .handle("getUser0185", handler)
    .handle("getUser0186", handler)
    .handle("getUser0187", handler)
    .handle("getUser0188", handler)
    .handle("getUser0189", handler)
    .handle("getUser0190", handler)
    .handle("getUser0191", handler)
    .handle("getUser0192", handler)
    .handle("getUser0193", handler)
    .handle("getUser0194", handler)
    .handle("getUser0195", handler)
    .handle("getUser0196", handler)
    .handle("getUser0197", handler)
    .handle("getUser0198", handler)
    .handle("getUser0199", handler)
    .handle("getUser0200", handler)
    .handle("getUser0201", handler)
    .handle("getUser0202", handler)
    .handle("getUser0203", handler)
    .handle("getUser0204", handler)
    .handle("getUser0205", handler)
    .handle("getUser0206", handler)
    .handle("getUser0207", handler)
    .handle("getUser0208", handler)
    .handle("getUser0209", handler)
    .handle("getUser0210", handler)
    .handle("getUser0211", handler)
    .handle("getUser0212", handler)
    .handle("getUser0213", handler)
    .handle("getUser0214", handler)
    .handle("getUser0215", handler)
    .handle("getUser0216", handler)
    .handle("getUser0217", handler)
    .handle("getUser0218", handler)
    .handle("getUser0219", handler)
    .handle("getUser0220", handler)
    .handle("getUser0221", handler)
    .handle("getUser0222", handler)
    .handle("getUser0223", handler)
    .handle("getUser0224", handler)
    .handle("getUser0225", handler)
    .handle("getUser0226", handler)
    .handle("getUser0227", handler)
    .handle("getUser0228", handler)
    .handle("getUser0229", handler)
    .handle("getUser0230", handler)
    .handle("getUser0231", handler)
    .handle("getUser0232", handler)
    .handle("getUser0233", handler)
    .handle("getUser0234", handler)
    .handle("getUser0235", handler)
    .handle("getUser0236", handler)
    .handle("getUser0237", handler)
    .handle("getUser0238", handler)
    .handle("getUser0239", handler)
    .handle("getUser0240", handler)
    .handle("getUser0241", handler)
    .handle("getUser0242", handler)
    .handle("getUser0243", handler)
    .handle("getUser0244", handler)
    .handle("getUser0245", handler)
    .handle("getUser0246", handler)
    .handle("getUser0247", handler)
    .handle("getUser0248", handler)
    .handle("getUser0249", handler)
    .handle("getUser0250", handler)
    .handle("getUser0251", handler)
    .handle("getUser0252", handler)
    .handle("getUser0253", handler)
    .handle("getUser0254", handler)
    .handle("getUser0255", handler)
    .handle("getUser0256", handler)
    .handle("getUser0257", handler)
    .handle("getUser0258", handler)
    .handle("getUser0259", handler)
    .handle("getUser0260", handler)
    .handle("getUser0261", handler)
    .handle("getUser0262", handler)
    .handle("getUser0263", handler)
    .handle("getUser0264", handler)
    .handle("getUser0265", handler)
    .handle("getUser0266", handler)
    .handle("getUser0267", handler)
    .handle("getUser0268", handler)
    .handle("getUser0269", handler)
    .handle("getUser0270", handler)
    .handle("getUser0271", handler)
    .handle("getUser0272", handler)
    .handle("getUser0273", handler)
    .handle("getUser0274", handler)
    .handle("getUser0275", handler)
    .handle("getUser0276", handler)
    .handle("getUser0277", handler)
    .handle("getUser0278", handler)
    .handle("getUser0279", handler)
    .handle("getUser0280", handler)
    .handle("getUser0281", handler)
    .handle("getUser0282", handler)
    .handle("getUser0283", handler)
    .handle("getUser0284", handler)
    .handle("getUser0285", handler)
    .handle("getUser0286", handler)
    .handle("getUser0287", handler)
    .handle("getUser0288", handler)
    .handle("getUser0289", handler)
    .handle("getUser0290", handler)
    .handle("getUser0291", handler)
    .handle("getUser0292", handler)
    .handle("getUser0293", handler)
    .handle("getUser0294", handler)
    .handle("getUser0295", handler)
    .handle("getUser0296", handler)
    .handle("getUser0297", handler)
    .handle("getUser0298", handler)
    .handle("getUser0299", handler)
    .handle("getUser0300", handler)
    .handle("getUser0301", handler)
    .handle("getUser0302", handler)
    .handle("getUser0303", handler)
    .handle("getUser0304", handler)
    .handle("getUser0305", handler)
    .handle("getUser0306", handler)
    .handle("getUser0307", handler)
    .handle("getUser0308", handler)
    .handle("getUser0309", handler)
    .handle("getUser0310", handler)
    .handle("getUser0311", handler)
    .handle("getUser0312", handler)
    .handle("getUser0313", handler)
    .handle("getUser0314", handler)
    .handle("getUser0315", handler)
    .handle("getUser0316", handler)
    .handle("getUser0317", handler)
    .handle("getUser0318", handler)
    .handle("getUser0319", handler)
    .handle("getUser0320", handler)
    .handle("getUser0321", handler)
    .handle("getUser0322", handler)
    .handle("getUser0323", handler)
    .handle("getUser0324", handler)
    .handle("getUser0325", handler)
    .handle("getUser0326", handler)
    .handle("getUser0327", handler)
    .handle("getUser0328", handler)
    .handle("getUser0329", handler)
    .handle("getUser0330", handler)
    .handle("getUser0331", handler)
    .handle("getUser0332", handler)
    .handle("getUser0333", handler)
    .handle("getUser0334", handler)
    .handle("getUser0335", handler)
    .handle("getUser0336", handler)
    .handle("getUser0337", handler)
    .handle("getUser0338", handler)
    .handle("getUser0339", handler)
    .handle("getUser0340", handler)
    .handle("getUser0341", handler)
    .handle("getUser0342", handler)
    .handle("getUser0343", handler)
    .handle("getUser0344", handler)
    .handle("getUser0345", handler)
    .handle("getUser0346", handler)
    .handle("getUser0347", handler)
    .handle("getUser0348", handler)
    .handle("getUser0349", handler)
    .handle("getUser0350", handler)
    .handle("getUser0351", handler)
    .handle("getUser0352", handler)
    .handle("getUser0353", handler)
    .handle("getUser0354", handler)
    .handle("getUser0355", handler)
    .handle("getUser0356", handler)
    .handle("getUser0357", handler)
    .handle("getUser0358", handler)
    .handle("getUser0359", handler)
    .handle("getUser0360", handler)
    .handle("getUser0361", handler)
    .handle("getUser0362", handler)
    .handle("getUser0363", handler)
    .handle("getUser0364", handler)
    .handle("getUser0365", handler)
    .handle("getUser0366", handler)
    .handle("getUser0367", handler)
    .handle("getUser0368", handler)
    .handle("getUser0369", handler)
    .handle("getUser0370", handler)
    .handle("getUser0371", handler)
    .handle("getUser0372", handler)
    .handle("getUser0373", handler)
    .handle("getUser0374", handler)
    .handle("getUser0375", handler)
    .handle("getUser0376", handler)
    .handle("getUser0377", handler)
    .handle("getUser0378", handler)
    .handle("getUser0379", handler)
    .handle("getUser0380", handler)
    .handle("getUser0381", handler)
    .handle("getUser0382", handler)
    .handle("getUser0383", handler)
    .handle("getUser0384", handler)
    .handle("getUser0385", handler)
    .handle("getUser0386", handler)
    .handle("getUser0387", handler)
    .handle("getUser0388", handler)
    .handle("getUser0389", handler)
    .handle("getUser0390", handler)
    .handle("getUser0391", handler)
    .handle("getUser0392", handler)
    .handle("getUser0393", handler)
    .handle("getUser0394", handler)
    .handle("getUser0395", handler)
    .handle("getUser0396", handler)
    .handle("getUser0397", handler)
    .handle("getUser0398", handler)
    .handle("getUser0399", handler)
    .handle("getUser0400", handler)
    .handle("getUser0401", handler)
    .handle("getUser0402", handler)
    .handle("getUser0403", handler)
    .handle("getUser0404", handler)
    .handle("getUser0405", handler)
    .handle("getUser0406", handler)
    .handle("getUser0407", handler)
    .handle("getUser0408", handler)
    .handle("getUser0409", handler)
    .handle("getUser0410", handler)
    .handle("getUser0411", handler)
    .handle("getUser0412", handler)
    .handle("getUser0413", handler)
    .handle("getUser0414", handler)
    .handle("getUser0415", handler)
    .handle("getUser0416", handler)
    .handle("getUser0417", handler)
    .handle("getUser0418", handler)
    .handle("getUser0419", handler)
    .handle("getUser0420", handler)
    .handle("getUser0421", handler)
    .handle("getUser0422", handler)
    .handle("getUser0423", handler)
    .handle("getUser0424", handler)
    .handle("getUser0425", handler)
    .handle("getUser0426", handler)
    .handle("getUser0427", handler)
    .handle("getUser0428", handler)
    .handle("getUser0429", handler)
    .handle("getUser0430", handler)
    .handle("getUser0431", handler)
    .handle("getUser0432", handler)
    .handle("getUser0433", handler)
    .handle("getUser0434", handler)
    .handle("getUser0435", handler)
    .handle("getUser0436", handler)
    .handle("getUser0437", handler)
    .handle("getUser0438", handler)
    .handle("getUser0439", handler)
    .handle("getUser0440", handler)
    .handle("getUser0441", handler)
    .handle("getUser0442", handler)
    .handle("getUser0443", handler)
    .handle("getUser0444", handler)
    .handle("getUser0445", handler)
    .handle("getUser0446", handler)
    .handle("getUser0447", handler)
    .handle("getUser0448", handler)
    .handle("getUser0449", handler)
    .handle("getUser0450", handler)
    .handle("getUser0451", handler)
    .handle("getUser0452", handler)
    .handle("getUser0453", handler)
    .handle("getUser0454", handler)
    .handle("getUser0455", handler)
    .handle("getUser0456", handler)
    .handle("getUser0457", handler)
    .handle("getUser0458", handler)
    .handle("getUser0459", handler)
    .handle("getUser0460", handler)
    .handle("getUser0461", handler)
    .handle("getUser0462", handler)
    .handle("getUser0463", handler)
    .handle("getUser0464", handler)
    .handle("getUser0465", handler)
    .handle("getUser0466", handler)
    .handle("getUser0467", handler)
    .handle("getUser0468", handler)
    .handle("getUser0469", handler)
    .handle("getUser0470", handler)
    .handle("getUser0471", handler)
    .handle("getUser0472", handler)
    .handle("getUser0473", handler)
    .handle("getUser0474", handler)
    .handle("getUser0475", handler)
    .handle("getUser0476", handler)
    .handle("getUser0477", handler)
    .handle("getUser0478", handler)
    .handle("getUser0479", handler)
    .handle("getUser0480", handler)
    .handle("getUser0481", handler)
    .handle("getUser0482", handler)
    .handle("getUser0483", handler)
    .handle("getUser0484", handler)
    .handle("getUser0485", handler)
    .handle("getUser0486", handler)
    .handle("getUser0487", handler)
    .handle("getUser0488", handler)
    .handle("getUser0489", handler)
    .handle("getUser0490", handler)
    .handle("getUser0491", handler)
    .handle("getUser0492", handler)
    .handle("getUser0493", handler)
    .handle("getUser0494", handler)
    .handle("getUser0495", handler)
    .handle("getUser0496", handler)
    .handle("getUser0497", handler)
    .handle("getUser0498", handler)
    .handle("getUser0499", handler)
    .handle("getUser0500", handler)
    .handle("getUser0501", handler)
    .handle("getUser0502", handler)
    .handle("getUser0503", handler)
    .handle("getUser0504", handler)
    .handle("getUser0505", handler)
    .handle("getUser0506", handler)
    .handle("getUser0507", handler)
    .handle("getUser0508", handler)
    .handle("getUser0509", handler)
    .handle("getUser0510", handler)
    .handle("getUser0511", handler)
    .handle("getUser0512", handler)
    .handle("getUser0513", handler)
    .handle("getUser0514", handler)
    .handle("getUser0515", handler)
    .handle("getUser0516", handler)
    .handle("getUser0517", handler)
    .handle("getUser0518", handler)
    .handle("getUser0519", handler)
    .handle("getUser0520", handler)
    .handle("getUser0521", handler)
    .handle("getUser0522", handler)
    .handle("getUser0523", handler)
    .handle("getUser0524", handler)
    .handle("getUser0525", handler)
    .handle("getUser0526", handler)
    .handle("getUser0527", handler)
    .handle("getUser0528", handler)
    .handle("getUser0529", handler)
    .handle("getUser0530", handler)
    .handle("getUser0531", handler)
    .handle("getUser0532", handler)
    .handle("getUser0533", handler)
    .handle("getUser0534", handler)
    .handle("getUser0535", handler)
    .handle("getUser0536", handler)
    .handle("getUser0537", handler)
    .handle("getUser0538", handler)
    .handle("getUser0539", handler)
    .handle("getUser0540", handler)
    .handle("getUser0541", handler)
    .handle("getUser0542", handler)
    .handle("getUser0543", handler)
    .handle("getUser0544", handler)
    .handle("getUser0545", handler)
    .handle("getUser0546", handler)
    .handle("getUser0547", handler)
    .handle("getUser0548", handler)
    .handle("getUser0549", handler)
    .handle("getUser0550", handler)
    .handle("getUser0551", handler)
    .handle("getUser0552", handler)
    .handle("getUser0553", handler)
    .handle("getUser0554", handler)
    .handle("getUser0555", handler)
    .handle("getUser0556", handler)
    .handle("getUser0557", handler)
    .handle("getUser0558", handler)
    .handle("getUser0559", handler)
    .handle("getUser0560", handler)
    .handle("getUser0561", handler)
    .handle("getUser0562", handler)
    .handle("getUser0563", handler)
    .handle("getUser0564", handler)
    .handle("getUser0565", handler)
    .handle("getUser0566", handler)
    .handle("getUser0567", handler)
    .handle("getUser0568", handler)
    .handle("getUser0569", handler)
    .handle("getUser0570", handler)
    .handle("getUser0571", handler)
    .handle("getUser0572", handler)
    .handle("getUser0573", handler)
    .handle("getUser0574", handler)
    .handle("getUser0575", handler)
    .handle("getUser0576", handler)
    .handle("getUser0577", handler)
    .handle("getUser0578", handler)
    .handle("getUser0579", handler)
    .handle("getUser0580", handler)
    .handle("getUser0581", handler)
    .handle("getUser0582", handler)
    .handle("getUser0583", handler)
    .handle("getUser0584", handler)
    .handle("getUser0585", handler)
    .handle("getUser0586", handler)
    .handle("getUser0587", handler)
    .handle("getUser0588", handler)
    .handle("getUser0589", handler)
    .handle("getUser0590", handler)
    .handle("getUser0591", handler)
    .handle("getUser0592", handler)
    .handle("getUser0593", handler)
    .handle("getUser0594", handler)
    .handle("getUser0595", handler)
    .handle("getUser0596", handler)
    .handle("getUser0597", handler)
    .handle("getUser0598", handler)
    .handle("getUser0599", handler)
    .handle("getUser0600", handler)
    .handle("getUser0601", handler)
    .handle("getUser0602", handler)
    .handle("getUser0603", handler)
    .handle("getUser0604", handler)
    .handle("getUser0605", handler)
    .handle("getUser0606", handler)
    .handle("getUser0607", handler)
    .handle("getUser0608", handler)
    .handle("getUser0609", handler)
    .handle("getUser0610", handler)
    .handle("getUser0611", handler)
    .handle("getUser0612", handler)
    .handle("getUser0613", handler)
    .handle("getUser0614", handler)
    .handle("getUser0615", handler)
    .handle("getUser0616", handler)
    .handle("getUser0617", handler)
    .handle("getUser0618", handler)
    .handle("getUser0619", handler)
    .handle("getUser0620", handler)
    .handle("getUser0621", handler)
    .handle("getUser0622", handler)
    .handle("getUser0623", handler)
    .handle("getUser0624", handler)
    .handle("getUser0625", handler)
    .handle("getUser0626", handler)
    .handle("getUser0627", handler)
    .handle("getUser0628", handler)
    .handle("getUser0629", handler)
    .handle("getUser0630", handler)
    .handle("getUser0631", handler)
    .handle("getUser0632", handler)
    .handle("getUser0633", handler)
    .handle("getUser0634", handler)
    .handle("getUser0635", handler)
    .handle("getUser0636", handler)
    .handle("getUser0637", handler)
    .handle("getUser0638", handler)
    .handle("getUser0639", handler)
    .handle("getUser0640", handler)
    .handle("getUser0641", handler)
    .handle("getUser0642", handler)
    .handle("getUser0643", handler)
    .handle("getUser0644", handler)
    .handle("getUser0645", handler)
    .handle("getUser0646", handler)
    .handle("getUser0647", handler)
    .handle("getUser0648", handler)
    .handle("getUser0649", handler)
    .handle("getUser0650", handler)
    .handle("getUser0651", handler)
    .handle("getUser0652", handler)
    .handle("getUser0653", handler)
    .handle("getUser0654", handler)
    .handle("getUser0655", handler)
    .handle("getUser0656", handler)
    .handle("getUser0657", handler)
    .handle("getUser0658", handler)
    .handle("getUser0659", handler)
    .handle("getUser0660", handler)
    .handle("getUser0661", handler)
    .handle("getUser0662", handler)
    .handle("getUser0663", handler)
    .handle("getUser0664", handler)
    .handle("getUser0665", handler)
    .handle("getUser0666", handler)
    .handle("getUser0667", handler)
    .handle("getUser0668", handler)
    .handle("getUser0669", handler)
    .handle("getUser0670", handler)
    .handle("getUser0671", handler)
    .handle("getUser0672", handler)
    .handle("getUser0673", handler)
    .handle("getUser0674", handler)
    .handle("getUser0675", handler)
    .handle("getUser0676", handler)
    .handle("getUser0677", handler)
    .handle("getUser0678", handler)
    .handle("getUser0679", handler)
    .handle("getUser0680", handler)
    .handle("getUser0681", handler)
    .handle("getUser0682", handler)
    .handle("getUser0683", handler)
    .handle("getUser0684", handler)
    .handle("getUser0685", handler)
    .handle("getUser0686", handler)
    .handle("getUser0687", handler)
    .handle("getUser0688", handler)
    .handle("getUser0689", handler)
    .handle("getUser0690", handler)
    .handle("getUser0691", handler)
    .handle("getUser0692", handler)
    .handle("getUser0693", handler)
    .handle("getUser0694", handler)
    .handle("getUser0695", handler)
    .handle("getUser0696", handler)
    .handle("getUser0697", handler)
    .handle("getUser0698", handler)
    .handle("getUser0699", handler)
    .handle("getUser0700", handler)
    .handle("getUser0701", handler)
    .handle("getUser0702", handler)
    .handle("getUser0703", handler)
    .handle("getUser0704", handler)
    .handle("getUser0705", handler)
    .handle("getUser0706", handler)
    .handle("getUser0707", handler)
    .handle("getUser0708", handler)
    .handle("getUser0709", handler)
    .handle("getUser0710", handler)
    .handle("getUser0711", handler)
    .handle("getUser0712", handler)
    .handle("getUser0713", handler)
    .handle("getUser0714", handler)
    .handle("getUser0715", handler)
    .handle("getUser0716", handler)
    .handle("getUser0717", handler)
    .handle("getUser0718", handler)
    .handle("getUser0719", handler)
    .handle("getUser0720", handler)
    .handle("getUser0721", handler)
    .handle("getUser0722", handler)
    .handle("getUser0723", handler)
    .handle("getUser0724", handler)
    .handle("getUser0725", handler)
    .handle("getUser0726", handler)
    .handle("getUser0727", handler)
    .handle("getUser0728", handler)
    .handle("getUser0729", handler)
    .handle("getUser0730", handler)
    .handle("getUser0731", handler)
    .handle("getUser0732", handler)
    .handle("getUser0733", handler)
    .handle("getUser0734", handler)
    .handle("getUser0735", handler)
    .handle("getUser0736", handler)
    .handle("getUser0737", handler)
    .handle("getUser0738", handler)
    .handle("getUser0739", handler)
    .handle("getUser0740", handler)
    .handle("getUser0741", handler)
    .handle("getUser0742", handler)
    .handle("getUser0743", handler)
    .handle("getUser0744", handler)
    .handle("getUser0745", handler)
    .handle("getUser0746", handler)
    .handle("getUser0747", handler)
    .handle("getUser0748", handler)
    .handle("getUser0749", handler)
    .handle("getUser0750", handler)
    .handle("getUser0751", handler)
    .handle("getUser0752", handler)
    .handle("getUser0753", handler)
    .handle("getUser0754", handler)
    .handle("getUser0755", handler)
    .handle("getUser0756", handler)
    .handle("getUser0757", handler)
    .handle("getUser0758", handler)
    .handle("getUser0759", handler)
    .handle("getUser0760", handler)
    .handle("getUser0761", handler)
    .handle("getUser0762", handler)
    .handle("getUser0763", handler)
    .handle("getUser0764", handler)
    .handle("getUser0765", handler)
    .handle("getUser0766", handler)
    .handle("getUser0767", handler)
    .handle("getUser0768", handler)
    .handle("getUser0769", handler)
    .handle("getUser0770", handler)
    .handle("getUser0771", handler)
    .handle("getUser0772", handler)
    .handle("getUser0773", handler)
    .handle("getUser0774", handler)
    .handle("getUser0775", handler)
    .handle("getUser0776", handler)
    .handle("getUser0777", handler)
    .handle("getUser0778", handler)
    .handle("getUser0779", handler)
    .handle("getUser0780", handler)
    .handle("getUser0781", handler)
    .handle("getUser0782", handler)
    .handle("getUser0783", handler)
    .handle("getUser0784", handler)
    .handle("getUser0785", handler)
    .handle("getUser0786", handler)
    .handle("getUser0787", handler)
    .handle("getUser0788", handler)
    .handle("getUser0789", handler)
    .handle("getUser0790", handler)
    .handle("getUser0791", handler)
    .handle("getUser0792", handler)
    .handle("getUser0793", handler)
    .handle("getUser0794", handler)
    .handle("getUser0795", handler)
    .handle("getUser0796", handler)
    .handle("getUser0797", handler)
    .handle("getUser0798", handler)
    .handle("getUser0799", handler)
    .handle("getUser0800", handler)
    .handle("getUser0801", handler)
    .handle("getUser0802", handler)
    .handle("getUser0803", handler)
    .handle("getUser0804", handler)
    .handle("getUser0805", handler)
    .handle("getUser0806", handler)
    .handle("getUser0807", handler)
    .handle("getUser0808", handler)
    .handle("getUser0809", handler)
    .handle("getUser0810", handler)
    .handle("getUser0811", handler)
    .handle("getUser0812", handler)
    .handle("getUser0813", handler)
    .handle("getUser0814", handler)
    .handle("getUser0815", handler)
    .handle("getUser0816", handler)
    .handle("getUser0817", handler)
    .handle("getUser0818", handler)
    .handle("getUser0819", handler)
    .handle("getUser0820", handler)
    .handle("getUser0821", handler)
    .handle("getUser0822", handler)
    .handle("getUser0823", handler)
    .handle("getUser0824", handler)
    .handle("getUser0825", handler)
    .handle("getUser0826", handler)
    .handle("getUser0827", handler)
    .handle("getUser0828", handler)
    .handle("getUser0829", handler)
    .handle("getUser0830", handler)
    .handle("getUser0831", handler)
    .handle("getUser0832", handler)
    .handle("getUser0833", handler)
    .handle("getUser0834", handler)
    .handle("getUser0835", handler)
    .handle("getUser0836", handler)
    .handle("getUser0837", handler)
    .handle("getUser0838", handler)
    .handle("getUser0839", handler)
    .handle("getUser0840", handler)
    .handle("getUser0841", handler)
    .handle("getUser0842", handler)
    .handle("getUser0843", handler)
    .handle("getUser0844", handler)
    .handle("getUser0845", handler)
    .handle("getUser0846", handler)
    .handle("getUser0847", handler)
    .handle("getUser0848", handler)
    .handle("getUser0849", handler)
    .handle("getUser0850", handler)
    .handle("getUser0851", handler)
    .handle("getUser0852", handler)
    .handle("getUser0853", handler)
    .handle("getUser0854", handler)
    .handle("getUser0855", handler)
    .handle("getUser0856", handler)
    .handle("getUser0857", handler)
    .handle("getUser0858", handler)
    .handle("getUser0859", handler)
    .handle("getUser0860", handler)
    .handle("getUser0861", handler)
    .handle("getUser0862", handler)
    .handle("getUser0863", handler)
    .handle("getUser0864", handler)
    .handle("getUser0865", handler)
    .handle("getUser0866", handler)
    .handle("getUser0867", handler)
    .handle("getUser0868", handler)
    .handle("getUser0869", handler)
    .handle("getUser0870", handler)
    .handle("getUser0871", handler)
    .handle("getUser0872", handler)
    .handle("getUser0873", handler)
    .handle("getUser0874", handler)
    .handle("getUser0875", handler)
    .handle("getUser0876", handler)
    .handle("getUser0877", handler)
    .handle("getUser0878", handler)
    .handle("getUser0879", handler)
    .handle("getUser0880", handler)
    .handle("getUser0881", handler)
    .handle("getUser0882", handler)
    .handle("getUser0883", handler)
    .handle("getUser0884", handler)
    .handle("getUser0885", handler)
    .handle("getUser0886", handler)
    .handle("getUser0887", handler)
    .handle("getUser0888", handler)
    .handle("getUser0889", handler)
    .handle("getUser0890", handler)
    .handle("getUser0891", handler)
    .handle("getUser0892", handler)
    .handle("getUser0893", handler)
    .handle("getUser0894", handler)
    .handle("getUser0895", handler)
    .handle("getUser0896", handler)
    .handle("getUser0897", handler)
    .handle("getUser0898", handler)
    .handle("getUser0899", handler)
    .handle("getUser0900", handler)
    .handle("getUser0901", handler)
    .handle("getUser0902", handler)
    .handle("getUser0903", handler)
    .handle("getUser0904", handler)
    .handle("getUser0905", handler)
    .handle("getUser0906", handler)
    .handle("getUser0907", handler)
    .handle("getUser0908", handler)
    .handle("getUser0909", handler)
    .handle("getUser0910", handler)
    .handle("getUser0911", handler)
    .handle("getUser0912", handler)
    .handle("getUser0913", handler)
    .handle("getUser0914", handler)
    .handle("getUser0915", handler)
    .handle("getUser0916", handler)
    .handle("getUser0917", handler)
    .handle("getUser0918", handler)
    .handle("getUser0919", handler)
    .handle("getUser0920", handler)
    .handle("getUser0921", handler)
    .handle("getUser0922", handler)
    .handle("getUser0923", handler)
    .handle("getUser0924", handler)
    .handle("getUser0925", handler)
    .handle("getUser0926", handler)
    .handle("getUser0927", handler)
    .handle("getUser0928", handler)
    .handle("getUser0929", handler)
    .handle("getUser0930", handler)
    .handle("getUser0931", handler)
    .handle("getUser0932", handler)
    .handle("getUser0933", handler)
    .handle("getUser0934", handler)
    .handle("getUser0935", handler)
    .handle("getUser0936", handler)
    .handle("getUser0937", handler)
    .handle("getUser0938", handler)
    .handle("getUser0939", handler)
    .handle("getUser0940", handler)
    .handle("getUser0941", handler)
    .handle("getUser0942", handler)
    .handle("getUser0943", handler)
    .handle("getUser0944", handler)
    .handle("getUser0945", handler)
    .handle("getUser0946", handler)
    .handle("getUser0947", handler)
    .handle("getUser0948", handler)
    .handle("getUser0949", handler)
    .handle("getUser0950", handler)
    .handle("getUser0951", handler)
    .handle("getUser0952", handler)
    .handle("getUser0953", handler)
    .handle("getUser0954", handler)
    .handle("getUser0955", handler)
    .handle("getUser0956", handler)
    .handle("getUser0957", handler)
    .handle("getUser0958", handler)
    .handle("getUser0959", handler)
    .handle("getUser0960", handler)
    .handle("getUser0961", handler)
    .handle("getUser0962", handler)
    .handle("getUser0963", handler)
    .handle("getUser0964", handler)
    .handle("getUser0965", handler)
    .handle("getUser0966", handler)
    .handle("getUser0967", handler)
    .handle("getUser0968", handler)
    .handle("getUser0969", handler)
    .handle("getUser0970", handler)
    .handle("getUser0971", handler)
    .handle("getUser0972", handler)
    .handle("getUser0973", handler)
    .handle("getUser0974", handler)
    .handle("getUser0975", handler)
    .handle("getUser0976", handler)
    .handle("getUser0977", handler)
    .handle("getUser0978", handler)
    .handle("getUser0979", handler)
    .handle("getUser0980", handler)
    .handle("getUser0981", handler)
    .handle("getUser0982", handler)
    .handle("getUser0983", handler)
    .handle("getUser0984", handler)
    .handle("getUser0985", handler)
    .handle("getUser0986", handler)
    .handle("getUser0987", handler)
    .handle("getUser0988", handler)
    .handle("getUser0989", handler)
    .handle("getUser0990", handler)
    .handle("getUser0991", handler)
    .handle("getUser0992", handler)
    .handle("getUser0993", handler)
    .handle("getUser0994", handler)
    .handle("getUser0995", handler)
    .handle("getUser0996", handler)
    .handle("getUser0997", handler)
    .handle("getUser0998", handler)
    .handle("getUser0999", handler)
    .handle("getUser1000", handler))

export type Layer = typeof layer
export type Handlers = HttpApiBuilder.Handlers.FromGroup<typeof group>
