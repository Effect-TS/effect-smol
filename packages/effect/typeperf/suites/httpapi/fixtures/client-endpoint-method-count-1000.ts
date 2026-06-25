// Measures HttpApiClient.endpoint method type production for one selected endpoint in a 1000-endpoint group.
import { Effect, Schema } from "effect"
import { HttpClient } from "effect/unstable/http"
import { HttpApi, HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"

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

const api = HttpApi.make("Api").add(
  HttpApiGroup.make("users").add(
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
)

declare const httpClient: HttpClient.HttpClient

const endpointClient = HttpApiClient.endpoint(api, {
  group: "users",
  endpoint: "getUser1000",
  httpClient
})

type EndpointClient = typeof endpointClient
type Method = typeof endpointClient extends Effect.Effect<infer _A, infer _E, infer _R> ? _A : never

export type Api = typeof api
export type GeneratedEndpointClient = EndpointClient
export type EndpointClientMethod = Method
export type EndpointClientRequest = Parameters<Method>[0]
export type EndpointClientResult = ReturnType<Method>
